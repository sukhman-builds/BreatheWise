const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('./index.js');

/**
 * Universal test request helper:
 * Attempts real HTTP fetch against server instance first.
 * If running in a secure sandbox without TCP loopback permissions (EACCES),
 * seamlessly falls back to direct in-memory Express request dispatch.
 */
async function testRequest(server, appInstance, urlPath) {
  const port = server.address().port;
  try {
    return await fetch(`http://localhost:${port}${urlPath}`);
  } catch (err) {
    const isEacces =
      err.cause?.code === 'EACCES' ||
      (err.cause?.errors && err.cause.errors.some(e => e.code === 'EACCES'));

    if (isEacces) {
      return new Promise((resolve) => {
        const req = new http.IncomingMessage();
        req.method = 'GET';
        req.url = urlPath;
        req.headers = { host: 'localhost' };

        let resHeaders = {};
        let statusCode = 200;
        let body = '';

        const res = new http.ServerResponse(req);
        res.writeHead = (status, headers) => {
          statusCode = status;
          if (headers) Object.assign(resHeaders, headers);
          return res;
        };
        res.setHeader = (k, v) => { resHeaders[k] = v; return res; };
        res.getHeader = (k) => resHeaders[k];
        res.end = (chunk) => {
          if (chunk) body += chunk;
          resolve({
            status: res.statusCode || statusCode,
            headers: resHeaders,
            json: async () => JSON.parse(body),
            text: async () => body
          });
        };

        appInstance.handle(req, res);
      });
    }
    throw err;
  }
}

test('Backend Health Endpoint returns 200 and expected shape', async () => {
  const server = app.listen(0);

  try {
    const res = await testRequest(server, app, '/api/health');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'success');
    assert.strictEqual(typeof body.hasApiKey, 'boolean');
    assert.strictEqual(typeof body.timestamp, 'string');
  } finally {
    server.close();
  }
});

test('Supported Stations Endpoint returns catalog of verified cities and stations', async () => {
  const server = app.listen(0);

  try {
    const res = await testRequest(server, app, '/api/stations');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.cities));
    assert.ok(Array.isArray(body.stations));
    assert.ok(body.cities.includes('Ambala'));
    assert.ok(body.cities.includes('New Delhi'));
    assert.ok(body.cities.includes('Chandigarh'));
    assert.ok(body.cities.includes('Jaipur'));
    assert.ok(body.stations.length >= 9);

    const delhiStation = body.stations.find(s => s.id === 8118);
    assert.ok(delhiStation);
    assert.strictEqual(delhiStation.pm25SensorId, 23534);

    const ambalaStation = body.stations.find(s => s.id === 6964);
    assert.ok(ambalaStation);
    assert.strictEqual(ambalaStation.pm25SensorId, 14258997);
  } finally {
    server.close();
  }
});

test('Invalid location ID returns 400 with structured error', async () => {
  const server = app.listen(0);

  try {
    const res = await testRequest(server, app, '/api/location/invalid-id');
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.code, 'INVALID_ID');
    assert.ok(body.error.includes('numeric'));
  } finally {
    server.close();
  }
});

test('Unknown /api route returns JSON 404', async () => {
  const server = app.listen(0);

  try {
    const res = await testRequest(server, app, '/api/nonexistent-route-xyz');
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.code, 'NOT_FOUND');
  } finally {
    server.close();
  }
});

test('Ambala station discovery returns authentic stations within 25 km', async () => {
  const server = app.listen(0);

  try {
    const res = await testRequest(server, app, '/api/ambala-stations');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.source, 'OpenAQ');
    assert.ok(Array.isArray(body.stations));
    assert.ok(body.stations.length > 0, 'Should find at least 1 genuine station near Ambala');

    const ambala = body.stations[0];
    assert.strictEqual(ambala.id, 6964);
    assert.ok(ambala.name.includes('Ambala'));
    assert.strictEqual(typeof ambala.latitude, 'number');
    assert.strictEqual(typeof ambala.longitude, 'number');
    assert.strictEqual(typeof body.fetchedAt, 'string');
  } finally {
    server.close();
  }
});

test('Location 8118 details returns New Delhi coordinates', async () => {
  const server = app.listen(0);

  try {
    const res = await testRequest(server, app, '/api/location/8118');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.locationId, 8118);
    assert.ok(body.name.includes('New Delhi') || body.name.includes('Delhi'));
    assert.ok(Math.abs(body.latitude - 28.635) < 0.1);
    assert.ok(Math.abs(body.longitude - 77.224) < 0.1);
  } finally {
    server.close();
  }
});

test('Air quality endpoint returns readings and fetchedAt timestamp', async () => {
  const server = app.listen(0);

  try {
    const res = await testRequest(server, app, '/api/air-quality/8118');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.locationId, 8118);
    assert.ok(Array.isArray(body.readings));
    assert.strictEqual(typeof body.fetchedAt, 'string');
  } finally {
    server.close();
  }
});

test('In-memory cache serves second request rapidly without re-fetching', async () => {
  const server = app.listen(0);

  try {
    const res1 = await testRequest(server, app, '/api/air-quality/8118');
    assert.strictEqual(res1.status, 200);

    const t1 = Date.now();
    const res2 = await testRequest(server, app, '/api/air-quality/8118');
    assert.strictEqual(res2.status, 200);
    const t2 = Date.now();

    const data1 = await res1.json();
    const data2 = await res2.json();

    assert.strictEqual(data1.fetchedAt, data2.fetchedAt, 'Cached response must retain fetchedAt timestamp');
    assert.ok((t2 - t1) < 50, `Cached response took ${t2 - t1}ms which should be virtually instant`);
  } finally {
    server.close();
  }
});
