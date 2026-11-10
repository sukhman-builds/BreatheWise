
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';

function ForecastChart({ title, data, dataKey, unit }) {
  const values = data
    .map(item => item[dataKey])
    .filter(value => Number.isFinite(value));

  const maxValue = Math.max(...values, 1);

  return (
    <div className="panel forecast-chart-panel">
      <h3>{title}</h3>
      <p className="muted">Hourly forecast · {unit}</p>

      {data.length === 0 ? (
        <p>No future forecast data available.</p>
      ) : (
        <div className="forecast-chart-track">
          {data.map((item, index) => {
            const value = item[dataKey];
            const valid = Number.isFinite(value);
            const height = valid ? Math.max((value / maxValue) * 100, 3) : 0;

            return (
              <div
                key={`${item.time}-${index}`}
                title={`${item.time} · ${valid ? `${value} ${unit}` : 'Unavailable'}`}
                style={{
                  flex: '1 0 18px',
                  minWidth: '18px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <div style={{
                  width: '100%',
                  height: `${height}%`,
                  minHeight: valid ? '3px' : '0',
                  background: '#00897b',
                  borderRadius: '5px 5px 0 0'
                }} />

                {index % 4 === 0 && (
                  <small style={{ fontSize: '10px', whiteSpace: 'nowrap' }}>
                    {new Date(item.time).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      hour12: false,
                      timeZone: 'Asia/Kolkata'
                    })}
                  </small>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ForecastView({
  latitude,
  longitude,
  stationName,
  cityName
}) {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const hasValidCoordinates =
    latitude != null &&
    longitude != null &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude));

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!hasValidCoordinates) return;

    const controller = new AbortController();

    async function loadForecast() {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude)
        });

        const response = await fetch(
          `${API_BASE_URL}/api/forecast?${params}`,
          { signal: controller.signal }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Unable to load forecast.');
        }

        setForecast(result);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Forecast request failed.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadForecast();

    return () => controller.abort();
  }, [latitude, longitude, refreshKey, hasValidCoordinates]);

  const futureHours = (forecast?.hourly || [])
    .filter(item => new Date(item.time).getTime() >= now)
    .slice(0, 24);

  const nextHour = futureHours[0];

  const maxUsAqi = futureHours.reduce((max, item) => {
    return Number.isFinite(item.usAqi)
      ? Math.max(max, item.usAqi)
      : max;
  }, 0);

  return (
    <div className="forecast-view">
      <div className="section-heading">
        <div>
          <h2>Air Quality Forecast</h2>
          <p>
            Model-based hourly outlook for {cityName ? `${cityName} · ` : ''}{stationName || 'selected station'}
            {hasValidCoordinates ? ` (${Number(latitude).toFixed(4)}°N, ${Number(longitude).toFixed(4)}°E)` : ''}
          </p>
        </div>

        <button
          type="button"
          className="btn-sm"
          onClick={() => setRefreshKey(value => value + 1)}
          disabled={loading || !hasValidCoordinates}
        >
          {loading ? 'Loading...' : '↻ Refresh Forecast'}
        </button>
      </div>

      {!hasValidCoordinates ? (
        <div className="panel" style={{ padding: '25px' }}>
          <h3>Forecast unavailable</h3>
          <p>Monitoring station coordinates are not available yet.</p>
        </div>
      ) : loading ? (
        <div className="panel" style={{ padding: '30px' }}>
          <p>Loading atmospheric forecast...</p>
        </div>
      ) : error ? (
        <div className="panel" style={{ padding: '25px' }}>
          <h3>Forecast unavailable</h3>
          <p>{error}</p>
          <button
            type="button"
            className="btn-sm"
            onClick={() => setRefreshKey(value => value + 1)}
          >
            Try Again
          </button>
        </div>
      ) : (
        <>
          <div className="forecast-hero-card">
            <div className="forecast-hero-icon">☼</div>
            <div className="forecast-hero-content">
              <span className="forecast-status-tag">
                MODEL-BASED FORECAST
              </span>
              <h3>Next 24 Hours Outlook</h3>
              <p className="forecast-lead">
                Forecast estimates from Open-Meteo atmospheric models.
                These are not direct ground-station measurements or official
                CPCB AQI readings.
              </p>
            </div>
          </div>

          <div className="pollutant-grid" style={{ marginTop: '20px' }}>
            <div className="pollutant-card">
              <span className="pollutant-name">Next-hour PM2.5</span>
              <h3>
                {nextHour?.pm25 ?? '—'}
                <small> µg/m³</small>
              </h3>
              <p>Modelled particulate concentration</p>
            </div>

            <div className="pollutant-card">
              <span className="pollutant-name">Next-hour PM10</span>
              <h3>
                {nextHour?.pm10 ?? '—'}
                <small> µg/m³</small>
              </h3>
              <p>Modelled particulate concentration</p>
            </div>

            <div className="pollutant-card">
              <span className="pollutant-name">Next-hour US AQI</span>
              <h3>{nextHour?.usAqi ?? '—'}</h3>
              <p>US AQI scale, not Indian CPCB AQI</p>
            </div>

            <div className="pollutant-card">
              <span className="pollutant-name">Peak forecast US AQI</span>
              <h3>{maxUsAqi || '—'}</h3>
              <p>Highest available value in the next 24 hours</p>
            </div>
          </div>

          <div className="section-heading" style={{ marginTop: '25px' }}>
            <div>
              <h2>Hourly Forecast Charts</h2>
              <p>Future hours only · Indian Standard Time (IST)</p>
            </div>
          </div>

          <div className="forecast-charts-grid">
            <ForecastChart
              title="PM2.5 Forecast"
              data={futureHours}
              dataKey="pm25"
              unit="µg/m³"
            />

            <ForecastChart
              title="PM10 Forecast"
              data={futureHours}
              dataKey="pm10"
              unit="µg/m³"
            />

            <ForecastChart
              title="US AQI Forecast"
              data={futureHours}
              dataKey="usAqi"
              unit="US AQI"
            />
          </div>

          <div className="panel" style={{ padding: '20px', marginTop: '20px' }}>
            <h3>Forecast Data Transparency</h3>
            <p><strong>Provider:</strong> Open-Meteo</p>
            <p><strong>Model:</strong> CAMS-based air quality forecast</p>
            <p><strong>Location:</strong> {cityName ? `${cityName} · ` : ''}{stationName}</p>
            <p><strong>Coordinates:</strong> {Number(latitude).toFixed(4)}°N, {Number(longitude).toFixed(4)}°E</p>
            <p><strong>Timezone:</strong> Asia/Kolkata (IST)</p>
            <p>
              <strong>Retrieved:</strong>{' '}
              {forecast?.fetchedAt
                ? new Date(forecast.fetchedAt).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata'
                  })
                : '—'}
            </p>
            <p>
              <strong>Forecast points displayed:</strong> {futureHours.length}
            </p>

            <p className="muted">
              Open-Meteo forecast values are model estimates. Spatial resolution
              is limited and local station conditions may differ. US AQI values
              must not be interpreted as official Indian CPCB AQI.
            </p>

            <p>
              Source:{' '}
              <a
                href="https://open-meteo.com/en/docs/air-quality-api"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open-Meteo Air Quality API
              </a>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
