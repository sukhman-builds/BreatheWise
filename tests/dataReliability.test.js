import test from 'node:test';
import assert from 'node:assert';
import { assessStationReliability, FRESHNESS_STATUS } from '../src/utils/dataReliability.js';
import { getStationById } from '../src/config/stations.js';

test('Data Reliability: Classifies live observation correctly', () => {
  const station = getStationById(8118);
  const now = Date.now();
  const currentAir = {
    locationId: 8118,
    readings: [
      { pollutant: 'pm25', value: 45.0, unit: 'µg/m³', datetime: { local: new Date(now - 30 * 60 * 1000).toISOString() } }
    ],
    fetchedAt: new Date(now - 10000).toISOString(),
    isStale: false
  };

  const report = assessStationReliability({
    station,
    currentAir,
    nowTimestamp: now
  });

  assert.strictEqual(report.freshness.status, FRESHNESS_STATUS.LIVE);
  assert.strictEqual(report.freshness.isLive, true);
  assert.strictEqual(report.freshness.isStale, false);
  assert.strictEqual(report.sensors.hasPm25, true);
  assert.strictEqual(report.backend.isOnline, true);
  assert.strictEqual(report.backend.statusLabel, 'Operational');
});

test('Data Reliability: Flags stale observation (>3 hours old) accurately', () => {
  const station = getStationById(8118);
  const now = Date.now();
  const fourHoursAgo = new Date(now - 4 * 3600000).toISOString();
  const currentAir = {
    locationId: 8118,
    readings: [
      { pollutant: 'pm25', value: 65.0, unit: 'µg/m³', datetime: { local: fourHoursAgo } }
    ],
    fetchedAt: new Date(now - 5000).toISOString(),
    isStale: true
  };

  const report = assessStationReliability({
    station,
    currentAir,
    nowTimestamp: now
  });

  assert.strictEqual(report.freshness.status, FRESHNESS_STATUS.STALE);
  assert.strictEqual(report.freshness.isStale, true);
  assert.ok(report.freshness.label.includes('Stale'));
});

test('Data Reliability: Identifies cached readings', () => {
  const station = getStationById(8118);
  const now = Date.now();
  const currentAir = {
    locationId: 8118,
    fromCache: true,
    readings: [
      { pollutant: 'pm25', value: 35.0, unit: 'µg/m³', datetime: { local: new Date(now - 45 * 60 * 1000).toISOString() } }
    ],
    fetchedAt: new Date(now - 120000).toISOString(),
    isStale: false
  };

  const report = assessStationReliability({
    station,
    currentAir,
    nowTimestamp: now
  });

  assert.strictEqual(report.freshness.status, FRESHNESS_STATUS.CACHED);
  assert.strictEqual(report.freshness.isCached, true);
});

test('Data Reliability: Handles unavailable readings and API errors transparently without fabricating readings', () => {
  const station = getStationById(8118);

  const report = assessStationReliability({
    station,
    currentAir: null,
    activeError: '504 Gateway Timeout from OpenAQ'
  });

  assert.strictEqual(report.freshness.status, FRESHNESS_STATUS.UNAVAILABLE);
  assert.ok(report.freshness.description.includes('504'));
  assert.strictEqual(report.sensors.activeReporting, 0);
  assert.strictEqual(report.sensors.hasPm25, false);
});

test('Data Reliability: Reports backend status accurately without fabricating Render cold starts', () => {
  const station = getStationById(8118);

  const reportOnline = assessStationReliability({
    station,
    apiHealth: { isOnline: true }
  });
  assert.strictEqual(reportOnline.backend.isOnline, true);
  assert.strictEqual(reportOnline.backend.statusLabel, 'Operational');

  const reportOffline = assessStationReliability({
    station,
    apiHealth: { isOnline: false, error: 'Connection refused' }
  });
  assert.strictEqual(reportOffline.backend.isOnline, false);
  assert.strictEqual(reportOffline.backend.statusLabel, 'Unavailable');
  assert.ok(reportOffline.backend.description.includes('Connection refused'));
  assert.strictEqual(reportOffline.backend.statusLabel.includes('Cold Start'), false, 'Must not claim cold start without measured signals');
});
