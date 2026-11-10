/**
 * BreatheWise Centralized API Client & Cache
 *
 * Implements:
 * 1. AbortController-based timeouts for all external and backend requests.
 * 2. Transient error retries with exponential backoff & jitter (502, 503, 504, network errors).
 * 3. No retries for permanent errors (400, 404, 401, 403).
 * 4. HTTP 429 rate limit detection and structured Retry-After handling.
 * 5. Safe JSON parsing with HTML/invalid-payload detection (e.g. Render 502/503 cold-start pages).
 * 6. In-flight request deduplication to prevent duplicate concurrent network calls.
 * 7. In-memory caching with timestamps, TTLs, and stale-fallback on network errors.
 * 8. Stale data flags to guarantee old cached data is NEVER misrepresented as live.
 */

import { API_BASE_URL } from '../config.js';

// Default configuration constants
export const DEFAULT_TIMEOUT_MS = 15000;
export const MAX_RETRIES = 2;
export const INITIAL_RETRY_DELAY_MS = 800;

// Cache TTL configurations (milliseconds)
export const CACHE_TTL = {
  AIR_QUALITY: 5 * 60 * 1000,      // 5 minutes
  LOCATION_META: 60 * 60 * 1000,   // 1 hour
  HISTORY: 15 * 60 * 1000,         // 15 minutes
  AMBALA_DISCOVERY: 60 * 60 * 1000,// 1 hour
  FORECAST: 30 * 60 * 1000,        // 30 minutes
  STATIONS_CATALOG: 60 * 60 * 1000 // 1 hour
};

// Max time to keep stale data available as offline/error fallback
export const MAX_STALE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory cache storage and in-flight request tracking
const cacheStore = new Map();
const inFlightRequests = new Map();

/**
 * Custom Error Classes for Structured Error Handling
 */
export class ApiError extends Error {
  constructor(message, status = 500, code = 'API_ERROR', details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.isTransient = [502, 503, 504, 408].includes(status);
  }
}

export class RateLimitError extends ApiError {
  constructor(message = 'Rate limit exceeded', retryAfter = 30) {
    super(message, 429, 'RATE_LIMITED');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    this.isTransient = false; // Rate limits should not be retried with fast exponential backoff
  }
}

export class TimeoutError extends ApiError {
  constructor(message = 'Request timed out. Server took too long to respond.', timeoutMs = DEFAULT_TIMEOUT_MS) {
    super(message, 504, 'TIMEOUT');
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    this.isTransient = true;
  }
}

export class NetworkError extends ApiError {
  constructor(message = 'Network connection failed. Please check your internet connection.', originalError = null) {
    super(message, 0, 'NETWORK_ERROR', originalError);
    this.name = 'NetworkError';
    this.isTransient = true;
  }
}

/**
 * Sleep helper for exponential backoff
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Cache Management Functions
 */
export function getFromCache(key) {
  const entry = cacheStore.get(key);
  if (!entry) return null;

  const now = Date.now();
  const age = now - entry.storedAt;
  const isExpired = now > entry.expiresAt;
  const isAvailableStale = age <= MAX_STALE_AGE_MS;

  if (isExpired && !isAvailableStale) {
    cacheStore.delete(key);
    return null;
  }

  return {
    data: entry.data,
    fetchedAt: entry.fetchedAt,
    isStale: isExpired || Boolean(entry.data?.isStale),
    expiresAt: entry.expiresAt,
    storedAt: entry.storedAt
  };
}

export function setInCache(key, data, ttlMs = CACHE_TTL.AIR_QUALITY, fetchedAt = null) {
  const now = Date.now();
  cacheStore.set(key, {
    data,
    fetchedAt: fetchedAt || data?.fetchedAt || new Date().toISOString(),
    storedAt: now,
    expiresAt: now + ttlMs
  });
}

export function clearCache(keyPrefix = null) {
  if (!keyPrefix) {
    cacheStore.clear();
    return;
  }
  for (const key of cacheStore.keys()) {
    if (key.startsWith(keyPrefix)) {
      cacheStore.delete(key);
    }
  }
}

export function getCacheStats() {
  return {
    size: cacheStore.size,
    keys: Array.from(cacheStore.keys()),
    inFlightCount: inFlightRequests.size
  };
}

/**
 * Determine whether an error is transient and eligible for limited retry
 */
export function isTransientError(err) {
  if (!err) return false;
  if (err instanceof TimeoutError) return true;
  if (err instanceof NetworkError) return true;
  if (err instanceof RateLimitError) return false; // Handled via countdown, not blind retry
  if (err instanceof ApiError) return err.isTransient;

  const msg = (err.message || '').toLowerCase();
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('load failed') || msg.includes('timeout') || msg.includes('aborted')) {
    return true;
  }
  return false;
}

/**
 * Central HTTP fetch wrapper with AbortController timeout, retry with backoff, and safe JSON parsing
 */
export async function requestWithRetry(url, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = MAX_RETRIES,
    retryDelayMs = INITIAL_RETRY_DELAY_MS,
    signal: externalSignal,
    headers = {},
    ...fetchOptions
  } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // If the external caller already aborted (e.g. component unmount or station switch), abort immediately
    if (externalSignal?.aborted) {
      const abortErr = new Error('Request was aborted by user or view navigation');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    const controller = new AbortController();
    let isTimedOut = false;

    // Internal timeout handler
    const timer = setTimeout(() => {
      isTimedOut = true;
      controller.abort();
    }, timeoutMs);

    // Link external cancellation signal if provided
    let cleanupExternalSignal = null;
    if (externalSignal) {
      const onExternalAbort = () => controller.abort();
      externalSignal.addEventListener('abort', onExternalAbort);
      cleanupExternalSignal = () => externalSignal.removeEventListener('abort', onExternalAbort);
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          'Accept': 'application/json',
          ...headers
        },
        signal: controller.signal
      });

      clearTimeout(timer);
      if (cleanupExternalSignal) cleanupExternalSignal();

      // Handle HTTP 429 Rate Limit
      if (response.status === 429) {
        const retryHeader = response.headers.get('Retry-After');
        const retryAfterSec = retryHeader ? parseInt(retryHeader, 10) : 30;
        let errMsg = 'OpenAQ rate limit reached. Re-querying shortly.';
        try {
          const body = await response.json();
          if (body?.error) errMsg = body.error;
        } catch {
          // ignore json parse error on 429 body
        }
        throw new RateLimitError(errMsg, isNaN(retryAfterSec) ? 30 : retryAfterSec);
      }

      // Read response body as text first to handle both JSON and non-JSON cleanly
      const text = await response.text();
      let json = null;
      let parseFailed = false;

      if (text && text.trim().length > 0) {
        try {
          json = JSON.parse(text);
        } catch {
          parseFailed = true;
        }
      }

      // Check HTTP status code
      if (!response.ok) {
        const status = response.status;
        const errorMsg = json?.error || (parseFailed ? `Server error (Status ${status}). Upstream returned non-JSON payload.` : `Server responded with status ${status}`);
        const errorCode = json?.code || (status === 404 ? 'NOT_FOUND' : status === 400 ? 'INVALID_REQUEST' : status >= 500 ? 'SERVER_ERROR' : 'HTTP_ERROR');

        const apiErr = new ApiError(errorMsg, status, errorCode, json);
        throw apiErr;
      }

      if (parseFailed) {
        throw new ApiError('Received invalid or non-JSON response from server.', 502, 'INVALID_JSON_RESPONSE');
      }

      return json;

    } catch (err) {
      clearTimeout(timer);
      if (cleanupExternalSignal) cleanupExternalSignal();

      // Determine the canonical error
      let currentError = err;
      if (isTimedOut) {
        currentError = new TimeoutError(`Request to ${url} timed out after ${timeoutMs}ms`, timeoutMs);
      } else if (err.name === 'AbortError') {
        if (externalSignal?.aborted) {
          throw err; // Do not retry intentional caller aborts
        }
        currentError = new TimeoutError(`Request was aborted after ${timeoutMs}ms`, timeoutMs);
      } else if (err instanceof ApiError) {
        currentError = err;
      } else if (err.name === 'TypeError' && err.message.includes('fetch')) {
        currentError = new NetworkError('Unable to connect to BreatheWise backend service.', err);
      }

      lastError = currentError;

      // Only retry transient errors and only if attempts remain
      if (attempt < maxRetries && isTransientError(currentError) && !externalSignal?.aborted) {
        // Exponential backoff with jitter: e.g. 800ms, 1600ms (+ 0-200ms jitter)
        const jitter = Math.floor(Math.random() * 200);
        const backoffMs = retryDelayMs * Math.pow(2, attempt) + jitter;
        await sleep(backoffMs);
        continue;
      }

      throw currentError;
    }
  }

  throw lastError || new ApiError('Request failed after retries', 500);
}

/**
 * Deduplicated Request Execution
 * If identical request is already in-flight, reuse its promise
 */
export async function deduplicatedRequest(cacheKey, fetcher) {
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const promise = (async () => {
    try {
      return await fetcher();
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

/**
 * High-Level BreatheWise API Methods
 */

/**
 * 1. Fetch Latest Air Quality Readings for a Location
 * Supports caching, background deduplication, and stale fallback
 */
export async function fetchAirQuality(locationId, options = {}) {
  const { force = false, signal = null, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const numId = Number(locationId);
  const cacheKey = `air-quality:${numId}`;

  // 1. Check in-memory cache
  if (!force) {
    const cached = getFromCache(cacheKey);
    if (cached && !cached.isStale) {
      return {
        ...cached.data,
        isStale: false,
        fromCache: true,
        fetchedAt: cached.fetchedAt
      };
    }
  }

  // 2. Execute deduplicated request
  return deduplicatedRequest(cacheKey, async () => {
    try {
      const url = `${API_BASE_URL}/api/air-quality/${numId}`;
      const data = await requestWithRetry(url, { timeoutMs, signal });

      // Cache successful response
      setInCache(cacheKey, data, CACHE_TTL.AIR_QUALITY, data.fetchedAt);

      return {
        ...data,
        isStale: Boolean(data.isStale),
        fromCache: false
      };
    } catch (err) {
      // Stale fallback: if network request fails, return cached data if available
      const fallback = getFromCache(cacheKey);
      if (fallback) {
        return {
          ...fallback.data,
          isStale: true,
          fromCache: true,
          fetchedAt: fallback.fetchedAt,
          fallbackReason: err.message || 'Live request failed; displaying cached data.'
        };
      }
      throw err;
    }
  });
}

/**
 * 2. Fetch Location Metadata & Coordinates
 */
export async function fetchLocationMeta(locationId, options = {}) {
  const { force = false, signal = null, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const numId = Number(locationId);
  const cacheKey = `location-meta:${numId}`;

  if (!force) {
    const cached = getFromCache(cacheKey);
    if (cached && !cached.isStale) {
      return { ...cached.data, fromCache: true };
    }
  }

  return deduplicatedRequest(cacheKey, async () => {
    try {
      const url = `${API_BASE_URL}/api/location/${numId}`;
      const data = await requestWithRetry(url, { timeoutMs, signal });
      setInCache(cacheKey, data, CACHE_TTL.LOCATION_META, data.fetchedAt);
      return { ...data, fromCache: false };
    } catch (err) {
      const fallback = getFromCache(cacheKey);
      if (fallback) {
        return { ...fallback.data, fromCache: true, isStale: true };
      }
      throw err;
    }
  });
}

/**
 * 3. Fetch Historical Measurements for a Sensor
 */
export async function fetchHistory(sensorId, options = {}) {
  const { force = false, signal = null, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  if (!sensorId) {
    return { measurements: [], fetchedAt: new Date().toISOString() };
  }

  const numId = Number(sensorId);
  const cacheKey = `history:${numId}`;

  if (!force) {
    const cached = getFromCache(cacheKey);
    if (cached && !cached.isStale) {
      return {
        ...cached.data,
        isStale: false,
        fromCache: true,
        fetchedAt: cached.fetchedAt
      };
    }
  }

  return deduplicatedRequest(cacheKey, async () => {
    try {
      const url = `${API_BASE_URL}/api/history/${numId}`;
      const data = await requestWithRetry(url, { timeoutMs, signal });
      setInCache(cacheKey, data, CACHE_TTL.HISTORY, data.fetchedAt);
      return {
        ...data,
        isStale: Boolean(data.isStale),
        fromCache: false
      };
    } catch (err) {
      const fallback = getFromCache(cacheKey);
      if (fallback) {
        return {
          ...fallback.data,
          isStale: true,
          fromCache: true,
          fetchedAt: fallback.fetchedAt,
          fallbackReason: err.message
        };
      }
      throw err;
    }
  });
}

/**
 * 4. Fetch Ambala 25km Discovery Stations
 */
export async function fetchAmbalaStations(options = {}) {
  const { force = false, signal = null, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const cacheKey = 'ambala-stations';

  if (!force) {
    const cached = getFromCache(cacheKey);
    if (cached && !cached.isStale) {
      return { ...cached.data, fromCache: true };
    }
  }

  return deduplicatedRequest(cacheKey, async () => {
    try {
      const url = `${API_BASE_URL}/api/ambala-stations`;
      const data = await requestWithRetry(url, { timeoutMs, signal });
      setInCache(cacheKey, data, CACHE_TTL.AMBALA_DISCOVERY, data.fetchedAt);
      return { ...data, fromCache: false };
    } catch (err) {
      const fallback = getFromCache(cacheKey);
      if (fallback) {
        return { ...fallback.data, fromCache: true, isStale: true };
      }
      throw err;
    }
  });
}

/**
 * 5. Fetch Forecast Data for Given Coordinates
 */
export async function fetchForecast(latitude, longitude, options = {}) {
  const { force = false, signal = null, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const lat = Number(latitude);
  const lon = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new ApiError('Valid numeric latitude and longitude coordinates are required.', 400, 'INVALID_COORDINATES');
  }

  const cacheKey = `forecast:${lat.toFixed(4)},${lon.toFixed(4)}`;

  if (!force) {
    const cached = getFromCache(cacheKey);
    if (cached && !cached.isStale) {
      return { ...cached.data, fromCache: true };
    }
  }

  return deduplicatedRequest(cacheKey, async () => {
    try {
      const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon)
      });
      const url = `${API_BASE_URL}/api/forecast?${params.toString()}`;
      const data = await requestWithRetry(url, { timeoutMs, signal });
      setInCache(cacheKey, data, CACHE_TTL.FORECAST, data.fetchedAt);
      return { ...data, fromCache: false };
    } catch (err) {
      const fallback = getFromCache(cacheKey);
      if (fallback) {
        return { ...fallback.data, fromCache: true, isStale: true };
      }
      throw err;
    }
  });
}

/**
 * 6. Fetch Supported Stations & Cities Catalog
 */
export async function fetchSupportedStations(options = {}) {
  const { force = false, signal = null, timeoutMs = 8000 } = options;
  const cacheKey = 'supported-stations';

  if (!force) {
    const cached = getFromCache(cacheKey);
    if (cached && !cached.isStale) {
      return { ...cached.data, fromCache: true };
    }
  }

  return deduplicatedRequest(cacheKey, async () => {
    const url = `${API_BASE_URL}/api/stations`;
    const data = await requestWithRetry(url, { timeoutMs, signal });
    setInCache(cacheKey, data, CACHE_TTL.STATIONS_CATALOG);
    return data;
  });
}

/**
 * 7. Check Backend Health & Render Warm-up Detection
 */
export async function checkBackendHealth(options = {}) {
  const { timeoutMs = 8000, signal = null } = options;
  try {
    const url = `${API_BASE_URL}/api/health`;
    const data = await requestWithRetry(url, { timeoutMs, signal, maxRetries: 1 });
    return { isOnline: true, ...data };
  } catch (err) {
    return {
      isOnline: false,
      error: err.message,
      isColdStart: err instanceof TimeoutError
    };
  }
}
