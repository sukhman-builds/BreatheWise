import { test } from 'node:test';
import assert from 'node:assert';
import {
  evaluateStationAlert,
  recordAlertEvent,
  dismissAlertById,
  ALERT_STATUS,
  CPCB_24H_THRESHOLD
} from '../src/utils/smartAlerts.js';

const mockStationA = {
  id: 8118,
  name: 'New Delhi (US Diplomatic Post)',
  shortName: 'US Post',
  cityName: 'New Delhi',
  locality: 'Chanakyapuri',
  provider: 'AirNow',
  network: 'U.S. Department of State',
  pm25SensorId: 23534
};

const mockStationB = {
  id: 6964,
  name: 'Patti Mehar, Ambala - HSPCB',
  shortName: 'Patti Mehar',
  cityName: 'Ambala',
  locality: 'Patti Mehar',
  provider: 'CPCB',
  network: 'HSPCB',
  pm25SensorId: 14258997
};

const mockStationNoSensor = {
  id: 9999,
  name: 'Sensorless Site',
  shortName: 'No Sensor',
  cityName: 'Test City',
  pm25SensorId: null
};

test('Smart Alerts: Active alert triggered when representative 24h average exceeds 60 µg/m³', () => {
  const representativeStats = {
    hasData: true,
    average: 84.5,
    count: 24,
    distinctHours: 24,
    spanHours: 23.5,
    quadrantsCovered: 4,
    coverageQuality: 'representative',
    category: { label: 'Moderate', color: '#f57f17' },
    windowPeriod: 'Past 24 Hours'
  };

  const result = evaluateStationAlert({
    station: mockStationA,
    stats24h: representativeStats,
    isStale: false,
    latestObservationTime: '2026-11-10T06:00:00Z',
    nowTimestamp: Date.now()
  });

  assert.strictEqual(result.status, ALERT_STATUS.ACTIVE_ALERT);
  assert.strictEqual(result.hasAlert, true);
  assert.ok(result.alert !== null);
  assert.strictEqual(result.alert.stationId, 8118);
  assert.strictEqual(result.alert.measuredValue, 84.5);
  assert.strictEqual(result.alert.threshold, 60);
  assert.strictEqual(result.alert.excessValue, 24.5);
  assert.strictEqual(result.alert.severity.levelName, 'Moderate');
  assert.ok(result.alert.reason.includes('exceeds the Indian National Ambient Air Quality Standard'));
});

test('Smart Alerts: Severity tiers correctly map across Moderate, Poor, Very Poor, and Severe', () => {
  const testTiers = [
    { avg: 75.0, expected: 'Moderate' },
    { avg: 105.0, expected: 'Poor' },
    { avg: 180.0, expected: 'Very Poor' },
    { avg: 285.0, expected: 'Severe' }
  ];

  for (const { avg, expected } of testTiers) {
    const stats = {
      hasData: true,
      average: avg,
      count: 24,
      distinctHours: 24,
      spanHours: 23.0,
      quadrantsCovered: 4,
      coverageQuality: 'representative',
      category: { label: expected }
    };

    const res = evaluateStationAlert({
      station: mockStationA,
      stats24h: stats,
      isStale: false,
      nowTimestamp: Date.now()
    });

    assert.strictEqual(res.status, ALERT_STATUS.ACTIVE_ALERT);
    assert.strictEqual(res.alert.severity.levelName, expected);
  }
});

test('Smart Alerts: Normal status when representative 24h average is <= 60 µg/m³', () => {
  const compliantStats = {
    hasData: true,
    average: 42.0,
    count: 24,
    distinctHours: 24,
    spanHours: 23.5,
    quadrantsCovered: 4,
    coverageQuality: 'representative',
    category: { label: 'Satisfactory', color: '#558b2f' },
    windowPeriod: 'Past 24 Hours'
  };

  const result = evaluateStationAlert({
    station: mockStationA,
    stats24h: compliantStats,
    isStale: false,
    nowTimestamp: Date.now()
  });

  assert.strictEqual(result.status, ALERT_STATUS.NORMAL);
  assert.strictEqual(result.hasAlert, false);
  assert.strictEqual(result.alert, null);
  assert.ok(result.diagnostic.title.includes('Within Standard'));
  assert.ok(result.diagnostic.message.includes('complies with the CPCB 24-hour standard'));
});

test('Smart Alerts: Never generates alert from insufficient or non-representative data', () => {
  // Case A: Insufficient data (<6 readings, clustered)
  const insufficientStats = {
    hasData: true,
    average: 150.0, // High average, but only 3 clustered observations
    count: 3,
    distinctHours: 2,
    spanHours: 2.0,
    quadrantsCovered: 1,
    coverageQuality: 'insufficient',
    statusDescription: 'Only 3 observation(s) in past 24h. Representative 24-hour distribution required.'
  };

  const resA = evaluateStationAlert({
    station: mockStationA,
    stats24h: insufficientStats,
    isStale: false
  });

  assert.strictEqual(resA.status, ALERT_STATUS.INSUFFICIENT_DATA);
  assert.strictEqual(resA.hasAlert, false);
  assert.strictEqual(resA.alert, null);
  assert.ok(resA.diagnostic.title.includes('Incomplete 24-Hour Coverage'));

  // Case B: Provisional data (partial coverage, e.g. 8 readings spanning 9 hours)
  const provisionalStats = {
    hasData: true,
    average: 125.0,
    count: 8,
    distinctHours: 8,
    spanHours: 9.0,
    quadrantsCovered: 2,
    coverageQuality: 'provisional',
    statusDescription: 'Does not meet representative 24h distribution criteria; category is provisional.'
  };

  const resB = evaluateStationAlert({
    station: mockStationA,
    stats24h: provisionalStats,
    isStale: false
  });

  assert.strictEqual(resB.status, ALERT_STATUS.INSUFFICIENT_DATA);
  assert.strictEqual(resB.hasAlert, false);
  assert.strictEqual(resB.alert, null);
});

test('Smart Alerts: Never generates alert when data is stale (> 3 hours old)', () => {
  const highAvgStats = {
    hasData: true,
    average: 110.0,
    count: 24,
    distinctHours: 24,
    spanHours: 23.5,
    quadrantsCovered: 4,
    coverageQuality: 'representative',
    category: { label: 'Poor' }
  };

  const result = evaluateStationAlert({
    station: mockStationA,
    stats24h: highAvgStats,
    isStale: true, // Measurement recorded 4 hours ago
    latestObservationTime: new Date(Date.now() - 4 * 3600000).toISOString(),
    nowTimestamp: Date.now()
  });

  assert.strictEqual(result.status, ALERT_STATUS.STALE_DATA);
  assert.strictEqual(result.hasAlert, false);
  assert.strictEqual(result.alert, null);
  assert.ok(result.diagnostic.title.includes('Data Stale'));
  assert.ok(result.diagnostic.details.includes('Alert generation is suspended'));
});

test('Smart Alerts: Handles API unavailable and missing sensors gracefully', () => {
  // Case A: Station without PM2.5 sensor
  const resNoSensor = evaluateStationAlert({
    station: mockStationNoSensor,
    stats24h: null
  });
  assert.strictEqual(resNoSensor.status, ALERT_STATUS.API_UNAVAILABLE);
  assert.strictEqual(resNoSensor.hasAlert, false);
  assert.ok(resNoSensor.diagnostic.title.includes('Sensor Not Reported'));

  // Case B: API Error
  const resError = evaluateStationAlert({
    station: mockStationA,
    stats24h: null,
    apiError: '504 Gateway Timeout from OpenAQ'
  });
  assert.strictEqual(resError.status, ALERT_STATUS.API_UNAVAILABLE);
  assert.strictEqual(resError.hasAlert, false);
  assert.ok(resError.diagnostic.title.includes('API Unavailable'));
});

test('Smart Alerts: Deduplication and alert history management', () => {
  const sampleAlert = {
    id: 'alert-8118-moderate-1700000000',
    stationId: 8118,
    measuredValue: 88.0,
    threshold: 60,
    severity: { levelName: 'Moderate' }
  };

  // 1. Initial addition
  let history = recordAlertEvent([], sampleAlert);
  assert.strictEqual(history.length, 1);
  assert.strictEqual(history[0].id, sampleAlert.id);

  // 2. Duplicate addition of the same alert event
  history = recordAlertEvent(history, sampleAlert);
  assert.strictEqual(history.length, 1, 'Duplicate alert must not be added to history');

  // 3. New distinct alert event
  const newAlert = {
    id: 'alert-6964-poor-1700003600',
    stationId: 6964,
    measuredValue: 95.0,
    threshold: 60,
    severity: { levelName: 'Poor' }
  };
  history = recordAlertEvent(history, newAlert);
  assert.strictEqual(history.length, 2);
  assert.strictEqual(history[0].id, newAlert.id, 'New alert should be placed at the top (reverse-chronological)');

  // 4. Dismissal
  history = dismissAlertById(history, 'alert-8118-moderate-1700000000');
  const dismissed = history.find(a => a.id === 'alert-8118-moderate-1700000000');
  assert.strictEqual(dismissed.isDismissed, true);
  assert.ok(typeof dismissed.dismissedAt === 'number');
});

test('Smart Alerts: Station switching evaluates each station independently', () => {
  // Station A (Delhi) is in alert status
  const statsDelhi = {
    hasData: true,
    average: 115.0,
    count: 24,
    distinctHours: 24,
    spanHours: 23.0,
    quadrantsCovered: 4,
    coverageQuality: 'representative',
    category: { label: 'Poor' }
  };

  // Station B (Ambala) is compliant
  const statsAmbala = {
    hasData: true,
    average: 48.0,
    count: 24,
    distinctHours: 24,
    spanHours: 23.0,
    quadrantsCovered: 4,
    coverageQuality: 'representative',
    category: { label: 'Satisfactory' }
  };

  const evalDelhi = evaluateStationAlert({
    station: mockStationA,
    stats24h: statsDelhi,
    isStale: false
  });
  assert.strictEqual(evalDelhi.status, ALERT_STATUS.ACTIVE_ALERT);
  assert.strictEqual(evalDelhi.alert.measuredValue, 115.0);

  const evalAmbala = evaluateStationAlert({
    station: mockStationB,
    stats24h: statsAmbala,
    isStale: false
  });
  assert.strictEqual(evalAmbala.status, ALERT_STATUS.NORMAL);
  assert.strictEqual(evalAmbala.hasAlert, false);
});
