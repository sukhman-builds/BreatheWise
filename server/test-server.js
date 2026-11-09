const test = require('node:test');
const assert = require('node:assert');
const app = require('./index.js');

test('Backend Health Endpoint returns 200 and expected shape', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'success');
    assert.strictEqual(typeof body.hasApiKey, 'boolean');
    assert.strictEqual(typeof body.timestamp, 'string');
  } finally {
    server.close();
  }
});

test('Invalid location ID returns 400 with structured error', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/location/invalid-id`);
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
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/nonexistent-route-xyz`);
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.code, 'NOT_FOUND');
  } finally {
    server.close();
  }
});

test('Ambala station discovery returns authentic stations within 25 km', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/ambala-stations`);
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
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/location/8118`);
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
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/api/air-quality/8118`);
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
  const port = server.address().port;

  try {
    const res1 = await fetch(`http://localhost:${port}/api/air-quality/8118`);
    assert.strictEqual(res1.status, 200);

    const t1 = Date.now();
    const res2 = await fetch(`http://localhost:${port}/api/air-quality/8118`);
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
