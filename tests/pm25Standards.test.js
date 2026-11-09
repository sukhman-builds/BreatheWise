import test from 'node:test';
import assert from 'node:assert';
import {
  calculate24HourStats,
  getSnapshotAdvisory,
  getPM25Category,
  parseMeasurementTimestamp
} from '../src/utils/pm25Standards.js';

test('calculate24HourStats: missing and empty data handling', () => {
  const emptyRes = calculate24HourStats([]);
  assert.strictEqual(emptyRes.hasData, false);
  assert.strictEqual(emptyRes.count, 0);
  assert.strictEqual(emptyRes.coverageQuality, 'insufficient');
  assert.strictEqual(emptyRes.statusLabel, 'Category Unavailable');
  assert.strictEqual(emptyRes.category.label, 'Unknown');

  const nullRes = calculate24HourStats(null);
  assert.strictEqual(nullRes.hasData, false);
  assert.strictEqual(nullRes.count, 0);
  assert.strictEqual(nullRes.coverageQuality, 'insufficient');

  const nonArrayRes = calculate24HourStats('invalid');
  assert.strictEqual(nonArrayRes.hasData, false);
});

test('calculate24HourStats: clustered readings fail representative distribution check', () => {
  const now = 1700000000000;
  // 16 readings all within 2 hours of each other (clustered in 1 quadrant)
  const clusteredReadings = [];
  for (let i = 0; i < 16; i++) {
    clusteredReadings.push({
      value: 85,
      datetime: new Date(now - (i * 7 * 60 * 1000)).toISOString() // all within ~1.8h
    });
  }

  const result = calculate24HourStats(clusteredReadings, now);
  assert.strictEqual(result.hasData, true);
  assert.strictEqual(result.count, 16);
  assert.ok(result.spanHours < 3, 'Span should be under 3 hours');
  assert.strictEqual(result.coverageQuality, 'insufficient', 'Clustered readings must be marked insufficient');
  assert.strictEqual(result.statusLabel, 'Category Unavailable');
  assert.strictEqual(result.category.label, 'Unknown', 'Must not assign CPCB category to clustered readings');
  assert.ok(result.statusDescription.includes('clustered'));
});

test('calculate24HourStats: well-distributed readings achieve representative rolling average', () => {
  const now = 1700000000000;
  // 24 hourly readings distributed across 23 hours (all 4 quadrants)
  const distributedReadings = [];
  for (let hour = 0; hour < 24; hour++) {
    distributedReadings.push({
      value: 45 + (hour % 5), // values between 45 and 49 (Satisfactory)
      datetime: new Date(now - (hour * 3600000)).toISOString()
    });
  }

  const result = calculate24HourStats(distributedReadings, now);
  assert.strictEqual(result.hasData, true);
  assert.strictEqual(result.count, 24);
  assert.strictEqual(result.coverageQuality, 'representative');
  assert.strictEqual(result.statusLabel, 'Rolling 24-hour PM2.5 average');
  assert.strictEqual(result.quadrantsCovered, 4);
  assert.ok(result.distinctHours >= 16);
  assert.ok(result.spanHours >= 18);
  assert.strictEqual(result.category.label, 'Satisfactory');
  assert.ok(result.statusDescription.includes('Representative rolling average'));
});

test('calculate24HourStats: insufficient coverage (<6 observations)', () => {
  const now = 1700000000000;
  // Only 3 observations
  const fewReadings = [
    { value: 50, datetime: new Date(now - 1 * 3600000).toISOString() },
    { value: 55, datetime: new Date(now - 5 * 3600000).toISOString() },
    { value: 60, datetime: new Date(now - 10 * 3600000).toISOString() }
  ];

  const result = calculate24HourStats(fewReadings, now);
  assert.strictEqual(result.hasData, true);
  assert.strictEqual(result.count, 3);
  assert.strictEqual(result.coverageQuality, 'insufficient');
  assert.strictEqual(result.statusLabel, 'Category Unavailable');
  assert.strictEqual(result.category.label, 'Unknown');
  assert.ok(result.statusDescription.includes('Only 3 observation(s)'));
});

test('calculate24HourStats: provisional status on partial diurnal coverage', () => {
  const now = 1700000000000;
  // 8 observations spanning 10 hours across 2 quadrants
  const partialReadings = [];
  for (let i = 0; i < 8; i++) {
    partialReadings.push({
      value: 70,
      datetime: new Date(now - (i * 1.25 * 3600000)).toISOString() // spans ~8.75h
    });
  }

  const result = calculate24HourStats(partialReadings, now);
  assert.strictEqual(result.hasData, true);
  assert.strictEqual(result.count, 8);
  assert.strictEqual(result.coverageQuality, 'provisional');
  assert.strictEqual(result.statusLabel, 'Provisional Rolling Average (Partial Coverage)');
  assert.strictEqual(result.category.label, 'Moderate');
  assert.ok(result.statusDescription.includes('provisional'));
});

test('parseMeasurementTimestamp: handles strings, nested datetime objects, and OpenAQ periods', () => {
  // ISO string
  const t1 = parseMeasurementTimestamp({ datetime: '2026-11-09T10:00:00.000Z' });
  assert.strictEqual(t1, new Date('2026-11-09T10:00:00.000Z').getTime());

  // Nested datetime object { utc, local }
  const t2 = parseMeasurementTimestamp({ datetime: { utc: '2026-11-09T10:00:00.000Z', local: '2026-11-09T15:30:00+05:30' } });
  assert.strictEqual(t2, new Date('2026-11-09T10:00:00.000Z').getTime());

  // utcDatetime field
  const t3 = parseMeasurementTimestamp({ utcDatetime: '2026-11-09T10:00:00.000Z' });
  assert.strictEqual(t3, new Date('2026-11-09T10:00:00.000Z').getTime());

  // OpenAQ period structure
  const t4 = parseMeasurementTimestamp({ period: { datetimeFrom: { utc: '2026-11-09T10:00:00.000Z' } } });
  assert.strictEqual(t4, new Date('2026-11-09T10:00:00.000Z').getTime());

  // Invalid or null
  assert.strictEqual(parseMeasurementTimestamp(null), null);
  assert.strictEqual(parseMeasurementTimestamp({ datetime: 'invalid-date' }), null);
});

test('getSnapshotAdvisory: provides non-regulatory advisory for hourly observations', () => {
  const lowSnap = getSnapshotAdvisory(20);
  assert.strictEqual(lowSnap.band, 'Low');
  assert.strictEqual(lowSnap.label, 'Low Hourly Concentration');
  assert.strictEqual(lowSnap.isRegulatory, false);
  assert.ok(lowSnap.disclaimer.includes('Single hourly observation snapshot'));
  assert.ok(!lowSnap.label.includes('Good'), 'Should not use 24h CPCB NAAQS Good label');

  const modSnap = getSnapshotAdvisory(75);
  assert.strictEqual(modSnap.band, 'Moderate');
  assert.strictEqual(modSnap.label, 'Moderate Hourly Concentration');
  assert.strictEqual(modSnap.isRegulatory, false);

  const highSnap = getSnapshotAdvisory(110);
  assert.strictEqual(highSnap.band, 'High');
  assert.strictEqual(highSnap.label, 'High Hourly Concentration');

  const vHighSnap = getSnapshotAdvisory(180);
  assert.strictEqual(vHighSnap.band, 'Very High');
  assert.strictEqual(vHighSnap.label, 'Very High Hourly Concentration');

  const severeSnap = getSnapshotAdvisory(320);
  assert.strictEqual(severeSnap.band, 'Severe');
  assert.strictEqual(severeSnap.label, 'Extremely Elevated Hourly Spike');

  const nullSnap = getSnapshotAdvisory(null);
  assert.strictEqual(nullSnap.band, 'Unknown');
  assert.strictEqual(nullSnap.label, 'Reading Unavailable');
});

test('getPM25Category: returns CPCB 24-hour levels', () => {
  assert.strictEqual(getPM25Category(25).label, 'Good');
  assert.strictEqual(getPM25Category(55).label, 'Satisfactory');
  assert.strictEqual(getPM25Category(85).label, 'Moderate');
  assert.strictEqual(getPM25Category(115).label, 'Poor');
  assert.strictEqual(getPM25Category(200).label, 'Very Poor');
  assert.strictEqual(getPM25Category(300).label, 'Severe');
  assert.strictEqual(getPM25Category(null).label, 'Unknown');
});
