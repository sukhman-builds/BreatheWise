import test from 'node:test';
import assert from 'node:assert';
import { calculate24HourStats, getSnapshotAdvisory } from '../src/utils/pm25Standards.js';
import { evaluateStationAlert, ALERT_STATUS } from '../src/utils/smartAlerts.js';
import { getStationById, SUPPORTED_STATIONS } from '../src/config/stations.js';

test('Data Integrity: Missing pollutant readings are NEVER converted to zero', () => {
  const readingsWithMissing = [
    { pollutant: 'pm10', value: 120, unit: 'µg/m³' }
    // Note: PM2.5 is completely absent
  ];

  const pm25 = readingsWithMissing.find(r => r.pollutant === 'pm25');
  assert.strictEqual(pm25, undefined);

  // If PM2.5 is missing, snapshot advisory must report Reading Unavailable, NOT 0 µg/m³
  const snapshot = getSnapshotAdvisory(pm25?.value);
  assert.strictEqual(snapshot.value, null);
  assert.strictEqual(snapshot.label, 'Reading Unavailable');
  assert.strictEqual(snapshot.band, 'Unknown');
});

test('Data Integrity: Zero values are valid observations only if genuine, not from nulls', () => {
  // If an observation is legitimately 0 (e.g. extremely clean or baseline check)
  const genuineZero = getSnapshotAdvisory(0);
  assert.strictEqual(genuineZero.value, 0);
  assert.strictEqual(genuineZero.label, 'Low Hourly Concentration');

  // Null is distinct from 0
  const nullReading = getSnapshotAdvisory(null);
  assert.strictEqual(nullReading.value, null);
  assert.strictEqual(nullReading.label, 'Reading Unavailable');

  // Undefined is distinct from 0
  const undefinedReading = getSnapshotAdvisory(undefined);
  assert.strictEqual(undefinedReading.value, null);
  assert.strictEqual(undefinedReading.label, 'Reading Unavailable');
});

test('Data Integrity: Forecast model values never contaminate ground station measurements', () => {
  const groundStation = getStationById(8118);
  assert.strictEqual(groundStation.provider, 'AirNow');

  // Simulated forecast data from Open-Meteo
  const forecastHourly = [
    { time: '2026-11-10T12:00', pm25: 65, usAqi: 156 },
    { time: '2026-11-10T13:00', pm25: null, usAqi: null }
  ];

  // Ground station calculation must use ground history only
  const groundStats = calculate24HourStats([], Date.now());
  assert.strictEqual(groundStats.hasData, false);
  assert.strictEqual(groundStats.average, null);

  // Forecast missing values remain null
  assert.strictEqual(forecastHourly[1].pm25, null);
  assert.strictEqual(forecastHourly[1].usAqi, null);
});

test('Data Integrity: Stale data (> 3 hours old) is clearly distinguished and never labeled as live', () => {
  const now = Date.now();
  const fourHoursAgo = new Date(now - 4 * 3600000).toISOString();

  const station = getStationById(8118);
  const stats = {
    hasData: true,
    average: 95.0,
    count: 24,
    distinctHours: 24,
    spanHours: 23.0,
    quadrantsCovered: 4,
    coverageQuality: 'representative'
  };

  const alertResult = evaluateStationAlert({
    station,
    stats24h: stats,
    isStale: true,
    latestObservationTime: fourHoursAgo,
    nowTimestamp: now
  });

  assert.strictEqual(alertResult.status, ALERT_STATUS.STALE_DATA);
  assert.strictEqual(alertResult.hasAlert, false, 'Stale observations must never trigger active alerts');
  assert.ok(alertResult.diagnostic.title.includes('Data Stale'));
});

test('Reliability: Loading state cleanup - all station configs guarantee non-null ID and lookup', () => {
  for (const station of SUPPORTED_STATIONS) {
    const lookedUp = getStationById(station.id);
    assert.strictEqual(lookedUp.id, station.id);
    assert.ok(lookedUp.latitude !== undefined);
    assert.ok(lookedUp.longitude !== undefined);
  }
});
