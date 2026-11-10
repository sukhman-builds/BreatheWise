import test from 'node:test';
import assert from 'node:assert';
import {
  requestWithRetry,
  fetchAirQuality,
  fetchHistory,
  fetchLocationMeta,
  fetchForecast,
  getFromCache,
  setInCache,
  clearCache,
  deduplicatedRequest,
  ApiError,
  RateLimitError,
  TimeoutError,
  NetworkError,
  isTransientError
} from '../src/api/client.js';

// Helper to temporarily override globalThis.fetch
function mockFetch(impl) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = impl;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test('API Client: API Timeout triggers TimeoutError after timeoutMs', async () => {
  const restore = mockFetch((url, options) => {
    return new Promise((resolve, reject) => {
      // Simulate hanging request that never finishes until aborted
      options.signal.addEventListener('abort', () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
  });

  try {
    await assert.rejects(
      async () => {
        await requestWithRetry('http://example.com/test-timeout', {
          timeoutMs: 50,
          maxRetries: 0
        });
      },
      (err) => {
        assert.ok(err instanceof TimeoutError, `Expected TimeoutError, got ${err.name}`);
        assert.strictEqual(err.status, 504);
        assert.strictEqual(err.code, 'TIMEOUT');
        return true;
      }
    );
  } finally {
    restore();
  }
});

test('API Client: Network failure is identified and surfaced as NetworkError', async () => {
  const restore = mockFetch(() => {
    return Promise.reject(new TypeError('Failed to fetch'));
  });

  try {
    await assert.rejects(
      async () => {
        await requestWithRetry('http://example.com/test-network', {
          timeoutMs: 100,
          maxRetries: 1,
          retryDelayMs: 10
        });
      },
      (err) => {
        assert.ok(err instanceof NetworkError, `Expected NetworkError, got ${err.name}`);
        assert.strictEqual(err.code, 'NETWORK_ERROR');
        return true;
      }
    );
  } finally {
    restore();
  }
});

test('API Client: HTTP 429 rate limit throws structured RateLimitError with retryAfter', async () => {
  const restore = mockFetch(async () => {
    return {
      status: 429,
      ok: false,
      headers: {
        get: (h) => (h.toLowerCase() === 'retry-after' ? '45' : null)
      },
      text: async () => JSON.stringify({ error: 'Too many requests' }),
      json: async () => ({ error: 'Too many requests' })
    };
  });

  try {
    await assert.rejects(
      async () => {
        await requestWithRetry('http://example.com/test-429', {
          timeoutMs: 100,
          maxRetries: 2
        });
      },
      (err) => {
        assert.ok(err instanceof RateLimitError, `Expected RateLimitError, got ${err.name}`);
        assert.strictEqual(err.status, 429);
        assert.strictEqual(err.retryAfter, 45);
        assert.strictEqual(err.code, 'RATE_LIMITED');
        return true;
      }
    );
  } finally {
    restore();
  }
});

test('API Client: HTTP 500 error surfaces structured ApiError without infinite retries', async () => {
  let callCount = 0;
  const restore = mockFetch(async () => {
    callCount++;
    return {
      status: 500,
      ok: false,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ error: 'Internal Server Error', code: 'SERVER_FAULT' })
    };
  });

  try {
    await assert.rejects(
      async () => {
        await requestWithRetry('http://example.com/test-500', {
          timeoutMs: 100,
          maxRetries: 2,
          retryDelayMs: 10
        });
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.status, 500);
        assert.strictEqual(err.code, 'SERVER_FAULT');
        return true;
      }
    );
    // 500 is not in transient retry list (502, 503, 504 are transient), so it should not retry
    assert.strictEqual(callCount, 1, 'Non-transient HTTP 500 must not be retried');
  } finally {
    restore();
  }
});

test('API Client: Invalid JSON / HTML error page from proxy is handled gracefully', async () => {
  const restore = mockFetch(async () => {
    return {
      status: 502,
      ok: false,
      headers: { get: () => 'text/html' },
      text: async () => '<html><body><h1>502 Bad Gateway</h1><p>Render cold start timeout</p></body></html>'
    };
  });

  try {
    await assert.rejects(
      async () => {
        await requestWithRetry('http://example.com/test-html', {
          timeoutMs: 100,
          maxRetries: 0
        });
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.status, 502);
        assert.ok(err.message.includes('502') || err.message.includes('non-JSON'));
        return true;
      }
    );
  } finally {
    restore();
  }
});

test('API Client: Transient errors (502/503/504) are retried with exponential backoff up to maxRetries', async () => {
  let attempts = 0;
  const restore = mockFetch(async () => {
    attempts++;
    if (attempts <= 2) {
      return {
        status: 503,
        ok: false,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify({ error: 'Service Unavailable' })
      };
    }
    return {
      status: 200,
      ok: true,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ status: 'recovered' })
    };
  });

  try {
    const result = await requestWithRetry('http://example.com/test-retry', {
      timeoutMs: 500,
      maxRetries: 2,
      retryDelayMs: 15
    });

    assert.strictEqual(attempts, 3, 'Should succeed on the 3rd attempt after 2 retries');
    assert.strictEqual(result.status, 'recovered');
  } finally {
    restore();
  }
});

test('API Client: Permanent client errors (400, 404) are NEVER retried', async () => {
  let attempts = 0;
  const restore = mockFetch(async () => {
    attempts++;
    return {
      status: 404,
      ok: false,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ error: 'Station not found', code: 'NOT_FOUND' })
    };
  });

  try {
    await assert.rejects(
      async () => {
        await requestWithRetry('http://example.com/test-404', {
          timeoutMs: 100,
          maxRetries: 2,
          retryDelayMs: 10
        });
      },
      (err) => {
        assert.strictEqual(err.status, 404);
        assert.strictEqual(err.code, 'NOT_FOUND');
        return true;
      }
    );
    assert.strictEqual(attempts, 1, 'HTTP 404 must fail immediately without retrying');
  } finally {
    restore();
  }
});

test('API Client: In-flight request deduplication prevents redundant concurrent network requests', async () => {
  let networkCalls = 0;

  const fetcher = async () => {
    networkCalls++;
    await new Promise(r => setTimeout(r, 40));
    return { value: 42, fetchedAt: new Date().toISOString() };
  };

  const p1 = deduplicatedRequest('test-dedup-key', fetcher);
  const p2 = deduplicatedRequest('test-dedup-key', fetcher);
  const p3 = deduplicatedRequest('test-dedup-key', fetcher);

  const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

  assert.strictEqual(networkCalls, 1, 'Concurrent requests for the same key must only hit the network once');
  assert.strictEqual(r1.value, 42);
  assert.strictEqual(r2.value, 42);
  assert.strictEqual(r3.value, 42);
});

test('API Client: Cache expiration and stale-fallback on network error', async () => {
  clearCache();

  // 1. Store item in cache with very short TTL
  const key = 'test-cache-key';
  setInCache(key, { name: 'Test Delhi' }, 30); // 30ms TTL

  const fresh = getFromCache(key);
  assert.ok(fresh !== null);
  assert.strictEqual(fresh.isStale, false);
  assert.strictEqual(fresh.data.name, 'Test Delhi');

  // 2. Wait for expiration
  await new Promise(r => setTimeout(r, 40));

  const expired = getFromCache(key);
  assert.ok(expired !== null);
  assert.strictEqual(expired.isStale, true, 'Expired cache entry must be flagged as isStale: true');
  assert.strictEqual(expired.data.name, 'Test Delhi', 'Cached data is preserved for stale fallback');

  clearCache();
});

test('API Client: Stale-data fallback when live request fails', async () => {
  clearCache();

  // Populate cache with previous reading
  const previousReading = {
    locationId: 8118,
    readings: [{ pollutant: 'pm25', value: 72.0, unit: 'µg/m³' }],
    fetchedAt: '2026-11-10T10:00:00.000Z'
  };
  setInCache('air-quality:8118', previousReading, 60000);

  // Now simulate network failure
  const restore = mockFetch(() => {
    return Promise.reject(new TypeError('Failed to fetch'));
  });

  try {
    const result = await fetchAirQuality(8118, { force: true, timeoutMs: 50 });
    assert.strictEqual(result.locationId, 8118);
    assert.strictEqual(result.isStale, true, 'Must clearly mark data as isStale when falling back to cache');
    assert.strictEqual(result.fromCache, true);
    assert.strictEqual(result.readings[0].value, 72.0);
    assert.ok(
      result.fallbackReason.includes('Failed to fetch') ||
      result.fallbackReason.includes('Unable to connect') ||
      result.fallbackReason.includes('failed')
    );
  } finally {
    restore();
    clearCache();
  }
});

test('API Client: Empty station response does not fabricate values or crash', async () => {
  clearCache();

  const restore = mockFetch(async () => {
    return {
      status: 200,
      ok: true,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({
        locationId: 8118,
        readings: [],
        fetchedAt: new Date().toISOString()
      })
    };
  });

  try {
    const result = await fetchAirQuality(8118, { force: true, timeoutMs: 100 });
    assert.ok(Array.isArray(result.readings));
    assert.strictEqual(result.readings.length, 0);
    // Verify no missing values were converted to zero
    const pm25 = result.readings.find(r => r.pollutant === 'pm25');
    assert.strictEqual(pm25, undefined, 'Missing readings must remain absent, never converted to 0');
  } finally {
    restore();
    clearCache();
  }
});

test('API Client: Partial station failure - Station A succeeds while Station B fails', async () => {
  clearCache();

  const restore = mockFetch(async (url) => {
    if (url.includes('/api/air-quality/8118')) {
      return {
        status: 200,
        ok: true,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify({
          locationId: 8118,
          readings: [{ pollutant: 'pm25', value: 85.0 }],
          fetchedAt: '2026-11-10T11:00:00Z'
        })
      };
    }
    if (url.includes('/api/air-quality/6964')) {
      return {
        status: 503,
        ok: false,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify({ error: 'Ambala sensor temporarily offline' })
      };
    }
    throw new Error('Unknown URL: ' + url);
  });

  try {
    const results = await Promise.allSettled([
      fetchAirQuality(8118, { force: true, timeoutMs: 100 }),
      fetchAirQuality(6964, { force: true, timeoutMs: 100, maxRetries: 0 })
    ]);

    assert.strictEqual(results[0].status, 'fulfilled', 'Station A must succeed');
    assert.strictEqual(results[0].value.locationId, 8118);
    assert.strictEqual(results[0].value.readings[0].value, 85.0);

    assert.strictEqual(results[1].status, 'rejected', 'Station B fails as expected');
    assert.ok(results[1].reason.message.includes('Ambala sensor temporarily offline'));
  } finally {
    restore();
    clearCache();
  }
});
