const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const {
  SUPPORTED_STATIONS,
  SUPPORTED_CITIES,
  getStationsByCity
} = require('./stations.js');

const app = express();

const PORT = process.env.PORT || 5000;
const API_KEY = process.env.OPENAQ_API_KEY;
const OPENAQ_URL = 'https://api.openaq.org/v3';
const OPENAQ_TIMEOUT_MS = parseInt(process.env.OPENAQ_TIMEOUT_MS, 10) || 15000;

// Log key configuration warning at startup if missing
if (!API_KEY) {
  console.warn('[WARNING] OPENAQ_API_KEY is not defined. Requests to OpenAQ API will fail until a key is configured.');
}

// Allowed CORS origins
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. curl, server-to-server, postman) where origin is undefined
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin '${origin}' not allowed by CORS`));
  },
  credentials: true
}));

app.use(express.json());

// In-memory cache storage with TTL and in-flight request deduplication
const cache = new Map();
const inFlightRequests = new Map();
const MAX_CACHE_ENTRIES = 200;

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
}

function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return { data: entry.data, fetchedAt: entry.fetchedAt };
}

function setInCache(key, data, fetchedAt, ttlMs) {
  pruneCache();
  cache.set(key, {
    data,
    fetchedAt,
    expiresAt: Date.now() + ttlMs
  });
}

// Central OpenAQ fetch helper with timeout, error translation, and request deduplication
async function fetchFromOpenAQ(endpoint, queryParams = {}, ttlMs = 300000) {
  if (!API_KEY) {
    const err = new Error('OpenAQ API key is missing on the server');
    err.code = 'SERVER_MISCONFIGURED';
    err.status = 500;
    throw err;
  }

  const queryString = new URLSearchParams(queryParams).toString();
  const url = `${OPENAQ_URL}${endpoint}${queryString ? `?${queryString}` : ''}`;
  const cacheKey = url;

  // Check cache first
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  // Deduplicate identical in-flight requests
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const fetchPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OPENAQ_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          'X-API-Key': API_KEY,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timer);

      if (response.status === 429) {
        const err = new Error('OpenAQ rate limit reached. Please retry in 30 seconds.');
        err.code = 'RATE_LIMITED';
        err.status = 429;
        err.retryAfter = 30;
        throw err;
      }

      if (response.status === 401 || response.status === 403) {
        const err = new Error('OpenAQ authentication failed. Please verify API key.');
        err.code = 'UPSTREAM_AUTH_ERROR';
        err.status = 502;
        throw err;
      }

      if (!response.ok) {
        const err = new Error(`OpenAQ responded with status ${response.status}`);
        err.code = 'UPSTREAM_ERROR';
        err.status = 502;
        err.upstreamStatus = response.status;
        throw err;
      }

      const json = await response.json();
      const fetchedAt = new Date().toISOString();
      setInCache(cacheKey, json, fetchedAt, ttlMs);
      return { data: json, fetchedAt };

    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('OpenAQ request timed out');
        timeoutErr.code = 'GATEWAY_TIMEOUT';
        timeoutErr.status = 504;
        throw timeoutErr;
      }
      throw err;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'BreatheWise backend is running!',
    hasApiKey: Boolean(API_KEY),
    timestamp: new Date().toISOString()
  });
});

// 1b. Supported Stations and Cities catalog
app.get('/api/stations', (req, res) => {
  const { city } = req.query;
  if (city) {
    const cityStations = getStationsByCity(city);
    return res.json({
      source: 'BreatheWise Verified Stations',
      city,
      count: cityStations.length,
      stations: cityStations
    });
  }

  res.json({
    source: 'BreatheWise Verified Stations',
    cities: SUPPORTED_CITIES,
    count: SUPPORTED_STATIONS.length,
    stations: SUPPORTED_STATIONS
  });
});

// 2. Fetch monitoring location details and coordinates
app.get('/api/location/:locationId', async (req, res, next) => {
  try {
    const { locationId } = req.params;

    if (!/^\d+$/.test(locationId)) {
      return res.status(400).json({
        error: 'Invalid location ID. ID must be numeric.',
        code: 'INVALID_ID'
      });
    }

    const { data, fetchedAt } = await fetchFromOpenAQ(`/locations/${locationId}`, {}, 3600000); // 1 hour cache
    const location = Array.isArray(data.results) ? data.results[0] : data.results;

    if (!location?.coordinates) {
      return res.status(404).json({
        error: 'Location coordinates unavailable',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      source: 'OpenAQ',
      locationId: parseInt(locationId, 10),
      name: location.name,
      locality: location.locality || null,
      country: location.country?.name || 'India',
      provider: location.provider?.name || null,
      owner: location.owner?.name || null,
      latitude: location.coordinates.latitude,
      longitude: location.coordinates.longitude,
      fetchedAt
    });

  } catch (err) {
    next(err);
  }
});

// 3. Fetch available sensors for a location
app.get('/api/location-sensors/:locationId', async (req, res, next) => {
  try {
    const { locationId } = req.params;

    if (!/^\d+$/.test(locationId)) {
      return res.status(400).json({
        error: 'Invalid location ID. ID must be numeric.',
        code: 'INVALID_ID'
      });
    }

    const { data, fetchedAt } = await fetchFromOpenAQ(`/locations/${locationId}/sensors`, {}, 3600000); // 1 hour cache

    const sensors = (data.results || []).map(sensor => ({
      id: sensor.id,
      parameter: sensor.parameter?.name,
      displayName: sensor.parameter?.displayName,
      unit: sensor.parameter?.units
    }));

    res.json({
      source: 'OpenAQ',
      locationId: parseInt(locationId, 10),
      sensors,
      fetchedAt
    });

  } catch (err) {
    next(err);
  }
});

// 4. Fetch latest air quality readings for a location
app.get('/api/air-quality/:locationId', async (req, res, next) => {
  try {
    const { locationId } = req.params;

    if (!/^\d+$/.test(locationId)) {
      return res.status(400).json({
        error: 'Invalid location ID. ID must be numeric.',
        code: 'INVALID_ID'
      });
    }

    const { data, fetchedAt } = await fetchFromOpenAQ(`/locations/${locationId}/sensors`, {}, 300000); // 5 min cache

    // Group sensors by pollutant parameter and select the freshest reading
    const pollutantMap = new Map();

    for (const sensor of (data.results || [])) {
      if (!sensor.latest || sensor.latest.value === null) continue;

      const param = sensor.parameter?.name;
      if (!param) continue;

      const reading = {
        pollutant: param,
        displayName: sensor.parameter?.displayName || param.toUpperCase(),
        unit: sensor.parameter?.units,
        value: sensor.latest.value,
        datetime: sensor.latest.datetime,
        sensorId: sensor.id
      };

      const existing = pollutantMap.get(param);
      if (!existing) {
        pollutantMap.set(param, reading);
      } else {
        // Compare datetimes, keep the fresher measurement
        const existingTime = new Date(existing.datetime?.utc || existing.datetime?.local || 0).getTime();
        const newTime = new Date(reading.datetime?.utc || reading.datetime?.local || 0).getTime();
        if (newTime > existingTime) {
          pollutantMap.set(param, reading);
        }
      }
    }

    const readings = Array.from(pollutantMap.values());

    res.json({
      source: 'OpenAQ',
      locationId: parseInt(locationId, 10),
      readings,
      fetchedAt,
      updatedAt: fetchedAt
    });

  } catch (err) {
    next(err);
  }
});

// 5. Fetch verified historical measurements (up to 7 days)
app.get('/api/history/:sensorId', async (req, res, next) => {
  try {
    const { sensorId } = req.params;

    if (!/^\d+$/.test(sensorId)) {
      return res.status(400).json({
        error: 'Invalid sensor ID. ID must be numeric.',
        code: 'INVALID_ID'
      });
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const queryParams = {
      datetime_from: sevenDaysAgo.toISOString(),
      datetime_to: now.toISOString(),
      limit: '1000',
      page: '1'
    };

    const { data, fetchedAt } = await fetchFromOpenAQ(`/sensors/${sensorId}/measurements`, queryParams, 900000); // 15 min cache

    const measurements = (data.results || [])
      .filter(item => {
        const datetime = item.period?.datetimeFrom?.local || item.period?.datetimeFrom?.utc;
        if (!datetime || item.value === null || !Number.isFinite(Number(item.value))) {
          return false;
        }
        const date = new Date(datetime);
        return date >= sevenDaysAgo && date <= now;
      })
      .map(item => ({
        value: item.value,
        datetime: item.period.datetimeFrom.local || item.period.datetimeFrom.utc,
        utcDatetime: item.period.datetimeFrom.utc,
        unit: item.parameter?.units || 'µg/m³'
      }))
      .reverse(); // Most recent first

    res.json({
      source: 'OpenAQ',
      sensorId: parseInt(sensorId, 10),
      measurements,
      fetchedAt
    });

  } catch (err) {
    next(err);
  }
});

// 6. Discover genuine monitoring stations near Ambala (within 25 km)
app.get('/api/ambala-stations', async (req, res, next) => {
  try {
    const queryParams = {
      coordinates: '30.378,76.776',
      radius: '25000',
      parameters_id: '2', // PM2.5
      limit: '100'
    };

    const { data, fetchedAt } = await fetchFromOpenAQ('/locations', queryParams, 3600000); // 1 hour cache

    const stations = (data.results || [])
      .filter(location => location.coordinates)
      .map(location => {
        // Find PM2.5 sensors
        const pm25Sensors = (location.sensors || []).filter(
          s => s.parameter?.name === 'pm25' || s.parameter?.id === 2
        );

        // Pick highest sensor ID as the modern sensor
        const activePm25Sensor = pm25Sensors.sort((a, b) => b.id - a.id)[0];

        return {
          id: location.id,
          name: location.name,
          locality: location.locality || 'Ambala',
          provider: location.provider?.name || 'CPCB / HSPCB',
          latitude: location.coordinates.latitude,
          longitude: location.coordinates.longitude,
          distanceMeters: location.distance ? Math.round(location.distance) : null,
          pm25SensorId: activePm25Sensor ? activePm25Sensor.id : null,
          sensors: (location.sensors || []).map(s => ({
            id: s.id,
            parameter: s.parameter?.name,
            displayName: s.parameter?.displayName,
            unit: s.parameter?.units
          }))
        };
      });

    res.json({
      source: 'OpenAQ',
      searchArea: 'Ambala (within 25 km radius)',
      referenceCoordinates: { latitude: 30.378, longitude: 76.776 },
      stationsCount: stations.length,
      stations,
      fetchedAt
    });

  } catch (err) {
    next(err);
  }
});


// 7. Fetch model-based air quality forecast from Open-Meteo
app.get('/api/forecast', async (req, res) => {
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);

  // Validate coordinates
  if (
    req.query.latitude === undefined ||
    req.query.longitude === undefined ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 ||
    longitude < -180 || longitude > 180
  ) {
    return res.status(400).json({
      error: 'Valid latitude and longitude are required.',
      code: 'INVALID_COORDINATES'
    });
  }

  const cacheKey = `forecast:${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const cached = getFromCache(cacheKey);

  if (cached) {
    return res.json(cached.data);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      hourly: 'pm2_5,pm10,us_aqi',
      forecast_days: '2',
      timezone: 'Asia/Kolkata'
    });

    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?${params}`;

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });

    if (!response.ok) {
      const err = new Error('Forecast provider is temporarily unavailable.');
      err.status = 502;
      err.code = 'FORECAST_PROVIDER_ERROR';
      throw err;
    }

    const data = await response.json();

    if (
      !data.hourly ||
      !Array.isArray(data.hourly.time) ||
      !Array.isArray(data.hourly.pm2_5) ||
      !Array.isArray(data.hourly.pm10) ||
      !Array.isArray(data.hourly.us_aqi)
    ) {
      const err = new Error('Forecast data is incomplete.');
      err.status = 502;
      err.code = 'INVALID_FORECAST_DATA';
      throw err;
    }

    const forecast = {
      source: 'Open-Meteo',
      model: 'CAMS-based air quality forecast',
      forecastType: 'Modelled forecast, not ground-station measurement',
      coordinates: { latitude, longitude },
      timezone: data.timezone || 'Asia/Kolkata',
      units: {
        pm2_5: 'µg/m³',
        pm10: 'µg/m³',
        us_aqi: 'US AQI'
      },
      hourly: data.hourly.time.map((time, index) => ({
        time,
        pm25: data.hourly.pm2_5[index] ?? null,
        pm10: data.hourly.pm10[index] ?? null,
        usAqi: data.hourly.us_aqi[index] ?? null
      })),
      fetchedAt: new Date().toISOString()
    };

    setInCache(cacheKey, forecast, forecast.fetchedAt, 1800000);
    res.json(forecast);

  } catch (err) {
    console.error('[Forecast Error]:', err.message);

    if (err.name === 'AbortError') {
      return res.status(504).json({
        error: 'Forecast request timed out. Please retry.',
        code: 'FORECAST_TIMEOUT'
      });
    }

    res.status(err.status || 502).json({
      error: err.message || 'Unable to fetch forecast.',
      code: err.code || 'FORECAST_ERROR'
    });

  } finally {
    clearTimeout(timer);
  }
});

// JSON 404 for unknown /api routes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: `Cannot ${req.method} ${req.originalUrl || req.url}`,
    code: 'NOT_FOUND'
  });
});

// Central error-handling middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[API Error]:', err.message);

  const status = err.status || 500;
  const responsePayload = {
    error: err.message || 'Internal server error',
    code: err.code || 'SERVER_ERROR'
  };

  if (err.retryAfter) {
    res.setHeader('Retry-After', String(err.retryAfter));
  }

  res.status(status).json(responsePayload);
});

// Start server with robust port collision detection if run directly
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`BreatheWise server running on http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[CRITICAL] Port ${PORT} is already in use by another process.`);
      console.error(`Please terminate the existing process using port ${PORT} or specify a different PORT in server/.env.\n`);
    } else {
      console.error(`\n[CRITICAL] Server startup error: ${err.message}\n`);
    }
    process.exit(1);
  });
}

module.exports = app;
