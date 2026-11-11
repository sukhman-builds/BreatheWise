import test from 'node:test';
import assert from 'node:assert';
import { generateWeeklyReport } from '../src/utils/weeklyReport.js';
import { getStationById } from '../src/config/stations.js';

test('Weekly Report: Aggregates daily observations and identifies cleanest vs most polluted days', () => {
  const station = getStationById(8118);
  const now = new Date('2026-11-10T20:00:00+05:30').getTime();

  const measurements = [];

  // Today (2026-11-10): 18 hours with value 40 (Complete coverage >= 16h, Compliant <= 60)
  for (let h = 1; h <= 18; h++) {
    const pad = String(h).padStart(2, '0');
    measurements.push({
      value: 40,
      datetime: `2026-11-10T${pad}:00:00+05:30`
    });
  }

  // Yesterday (2026-11-09): 20 hours with value 25 (Complete coverage >= 16h, Compliant <= 60 - Cleanest)
  for (let h = 1; h <= 20; h++) {
    const pad = String(h).padStart(2, '0');
    measurements.push({
      value: 25,
      datetime: `2026-11-09T${pad}:00:00+05:30`
    });
  }

  // 2 days ago (2026-11-08): 18 hours with value 150 (Complete coverage >= 16h, Exceeded > 60 - Most Polluted)
  for (let h = 1; h <= 18; h++) {
    const pad = String(h).padStart(2, '0');
    measurements.push({
      value: 150,
      datetime: `2026-11-08T${pad}:00:00+05:30`
    });
  }

  const report = generateWeeklyReport(measurements, station, now);

  assert.strictEqual(report.dailyBreakdown.length, 7);
  assert.strictEqual(report.summary.reportingDaysCount, 3);
  assert.strictEqual(report.summary.evaluableDaysCount, 3);
  assert.strictEqual(report.summary.insufficientDaysCount, 0);
  assert.strictEqual(report.summary.totalDays, 7);

  // Cleanest day should be ~25 µg/m³
  assert.ok(report.summary.cleanestDay !== null);
  assert.strictEqual(report.summary.cleanestDay.average, 25.0);
  assert.strictEqual(report.summary.cleanestDay.category.label, 'Good');
  assert.strictEqual(report.summary.cleanestDay.isCompliant, true);

  // Most polluted day should be ~150 µg/m³
  assert.ok(report.summary.mostPollutedDay !== null);
  assert.strictEqual(report.summary.mostPollutedDay.average, 150.0);
  assert.strictEqual(report.summary.mostPollutedDay.category.label, 'Very Poor');
  assert.strictEqual(report.summary.mostPollutedDay.isCompliant, false);

  // Compliant count: 2 of 3 (yesterday 25 and today 40 are <= 60; 2 days ago 150 > 60)
  assert.strictEqual(report.summary.compliantDaysCount, 2);
  assert.strictEqual(report.summary.exceedanceDaysCount, 1);

  // Days with no data must have average: null (NEVER 0)
  const emptyDays = report.dailyBreakdown.filter(d => !d.hasData);
  assert.strictEqual(emptyDays.length, 4);
  for (const emptyDay of emptyDays) {
    assert.strictEqual(emptyDay.average, null);
    assert.strictEqual(emptyDay.count, 0);
    assert.strictEqual(emptyDay.isCompliant, null);
    assert.strictEqual(emptyDay.complianceStatus, 'unmonitored');
  }
});

test('Weekly Report: Incomplete days (<16h) are strictly marked insufficient data, never compliant', () => {
  const station = getStationById(8118);
  const now = new Date('2026-11-10T20:00:00+05:30').getTime();

  // Day with only 5 readings (average 20 µg/m³ - low concentration, but INSUFFICIENT diurnal coverage)
  const measurements = [];
  for (let h = 1; h <= 5; h++) {
    const pad = String(h).padStart(2, '0');
    measurements.push({
      value: 20,
      datetime: `2026-11-10T${pad}:00:00+05:30`
    });
  }

  const report = generateWeeklyReport(measurements, station, now);

  const reportingDay = report.dailyBreakdown.find(d => d.hasData);
  assert.ok(reportingDay);
  assert.strictEqual(reportingDay.count, 5);
  assert.strictEqual(reportingDay.coverageQuality, 'insufficient');
  assert.strictEqual(reportingDay.isCompliant, null, 'Incomplete day must have isCompliant: null, NOT true');
  assert.strictEqual(reportingDay.complianceStatus, 'insufficient');
  assert.ok(reportingDay.complianceLabel.includes('Insufficient'));

  // Evaluable days count must be 0, not 1
  assert.strictEqual(report.summary.evaluableDaysCount, 0);
  assert.strictEqual(report.summary.compliantDaysCount, 0);
  assert.strictEqual(report.summary.insufficientDaysCount, 1);
});

test('Weekly Report: Handles empty measurements without crashing or fabricating averages', () => {
  const station = getStationById(6964);
  const report = generateWeeklyReport([], station);

  assert.strictEqual(report.dailyBreakdown.length, 7);
  assert.strictEqual(report.summary.reportingDaysCount, 0);
  assert.strictEqual(report.summary.evaluableDaysCount, 0);
  assert.strictEqual(report.summary.totalObservations, 0);
  assert.strictEqual(report.summary.weeklyAverage, null);
  assert.strictEqual(report.summary.cleanestDay, null);
  assert.strictEqual(report.summary.mostPollutedDay, null);

  // Safe against null/undefined measurements
  const nullReport = generateWeeklyReport(null, station);
  assert.strictEqual(nullReport.summary.totalObservations, 0);
  assert.strictEqual(nullReport.summary.weeklyAverage, null);
});

test('Weekly Report: Aggregates measurements by IST hour before daily average (no duplicate hour overweighting)', () => {
  const station = getStationById(8118);
  const now = new Date('2026-11-10T20:00:00+05:30').getTime();

  // Today (2026-11-10):
  // Hour 10 has 5 readings of value 100 (e.g., every 10 mins). Hourly mean = 100
  // Hour 11 has 1 reading of value 20. Hourly mean = 20
  // Unweighted mean of raw readings would be: (5 * 100 + 20) / 6 = 520 / 6 = 86.7
  // Hourly aggregation: (100 + 20) / 2 = 60.0
  const measurements = [
    { value: 100, datetime: '2026-11-10T10:05:00+05:30' },
    { value: 100, datetime: '2026-11-10T10:15:00+05:30' },
    { value: 100, datetime: '2026-11-10T10:30:00+05:30' },
    { value: 100, datetime: '2026-11-10T10:45:00+05:30' },
    { value: 100, datetime: '2026-11-10T10:55:00+05:30' },
    { value: 20, datetime: '2026-11-10T11:30:00+05:30' }
  ];

  const report = generateWeeklyReport(measurements, station, now);
  const today = report.dailyBreakdown.find(d => d.dateKey === '2026-11-10');

  assert.ok(today);
  assert.strictEqual(today.count, 6);
  assert.strictEqual(today.distinctHours, 2);
  assert.strictEqual(today.average, 60.0, 'Daily average must be 60.0 via hourly aggregation, NOT 86.7');
});

test('Weekly Report: Insufficient days are strictly excluded from cleanest and most polluted day rankings', () => {
  const station = getStationById(8118);
  const now = new Date('2026-11-10T20:00:00+05:30').getTime();

  const measurements = [];

  // Day 1 (yesterday, 2026-11-09): only 4 hours monitored, very low values (10 µg/m³) -> Insufficient coverage (<16h)
  for (let h = 1; h <= 4; h++) {
    const pad = String(h).padStart(2, '0');
    measurements.push({ value: 10, datetime: `2026-11-09T${pad}:00:00+05:30` });
  }

  // Day 2 (today, 2026-11-10): 17 hours monitored, value 45 µg/m³ -> Sufficient coverage (evaluable >=16h)
  for (let h = 1; h <= 17; h++) {
    const pad = String(h).padStart(2, '0');
    measurements.push({ value: 45, datetime: `2026-11-10T${pad}:00:00+05:30` });
  }

  const report = generateWeeklyReport(measurements, station, now);

  // Even though 2026-11-09 had lower concentration (10 µg/m³), it had insufficient coverage (<16h).
  // Therefore, cleanestDay must be the evaluable day (2026-11-10 with 45 µg/m³), NEVER the insufficient day.
  assert.ok(report.summary.cleanestDay !== null);
  assert.strictEqual(report.summary.cleanestDay.dateKey, '2026-11-10');
  assert.strictEqual(report.summary.cleanestDay.average, 45.0);
  assert.strictEqual(report.summary.cleanestDay.coverageQuality, 'sufficient');

  assert.ok(report.summary.mostPollutedDay !== null);
  assert.strictEqual(report.summary.mostPollutedDay.dateKey, '2026-11-10');

  // Verify that if ALL reporting days have insufficient coverage, cleanestDay and mostPollutedDay are null
  const insufficientOnlyReport = generateWeeklyReport(
    [
      { value: 5, datetime: '2026-11-10T10:00:00+05:30' },
      { value: 5, datetime: '2026-11-10T11:00:00+05:30' }
    ],
    station,
    now
  );
  assert.strictEqual(insufficientOnlyReport.summary.cleanestDay, null);
  assert.strictEqual(insufficientOnlyReport.summary.mostPollutedDay, null);
});

test('Weekly Report: Weekly average uses unweighted mean of observed hourly averages to prevent duplicate distortion', () => {
  const station = getStationById(8118);
  const now = new Date('2026-11-10T20:00:00+05:30').getTime();

  // Day 1 (2026-11-09):
  // Hour 08: 10 duplicate readings of value 120 (hourly average = 120)
  // Hour 09: 1 reading of value 40 (hourly average = 40)
  // Day 2 (2026-11-10):
  // Hour 08: 1 reading of value 50 (hourly average = 50)
  // Total observed hourly averages across 7 days: [120, 40, 50]
  // Mean of hourly averages: (120 + 40 + 50) / 3 = 70.0
  // (Unweighted raw values mean would be: (10 * 120 + 40 + 50) / 12 = 1290 / 12 = 107.5)
  const measurements = [];
  for (let i = 0; i < 10; i++) {
    measurements.push({ value: 120, datetime: `2026-11-09T08:${String(i * 5).padStart(2, '0')}:00+05:30` });
  }
  measurements.push({ value: 40, datetime: '2026-11-09T09:15:00+05:30' });
  measurements.push({ value: 50, datetime: '2026-11-10T08:30:00+05:30' });

  const report = generateWeeklyReport(measurements, station, now);

  assert.strictEqual(report.summary.totalObservations, 12);
  assert.strictEqual(report.summary.weeklyAverage, 70.0, 'Weekly average must be 70.0 based on mean of hourly averages, NOT 107.5');
});

test('Weekly Report: IST midnight boundary assigns readings to correct calendar days without 24h drift', () => {
  const station = getStationById(8118);
  const now = new Date('2026-11-10T12:00:00+05:30').getTime();

  // Measurement 1: 2026-11-09 at 23:59:59 IST
  // Measurement 2: 2026-11-10 at 00:00:01 IST
  const measurements = [
    { value: 80, datetime: '2026-11-09T23:59:59+05:30' },
    { value: 30, datetime: '2026-11-10T00:00:01+05:30' }
  ];

  const report = generateWeeklyReport(measurements, station, now);

  const dayNov9 = report.dailyBreakdown.find(d => d.dateKey === '2026-11-09');
  const dayNov10 = report.dailyBreakdown.find(d => d.dateKey === '2026-11-10');

  assert.ok(dayNov9, '2026-11-09 must exist in 7-day breakdown');
  assert.ok(dayNov10, '2026-11-10 must exist in 7-day breakdown');

  assert.strictEqual(dayNov9.count, 1);
  assert.strictEqual(dayNov9.average, 80.0);
  assert.strictEqual(dayNov9.distinctHours, 1);

  assert.strictEqual(dayNov10.count, 1);
  assert.strictEqual(dayNov10.average, 30.0);
  assert.strictEqual(dayNov10.distinctHours, 1);
});

test('Weekly Report: Threshold boundary evaluation — exactly 16 distinct hours vs 15 hours', () => {
  const station = getStationById(8118);
  const now = new Date('2026-11-10T20:00:00+05:30').getTime();

  const measurements = [];

  // Day 1 (yesterday 2026-11-09): exactly 16 distinct hours with value 50
  for (let h = 0; h < 16; h++) {
    const pad = String(h).padStart(2, '0');
    measurements.push({ value: 50, datetime: `2026-11-09T${pad}:00:00+05:30` });
  }

  // Day 2 (today 2026-11-10): exactly 15 distinct hours with value 50
  for (let h = 0; h < 15; h++) {
    const pad = String(h).padStart(2, '0');
    measurements.push({ value: 50, datetime: `2026-11-10T${pad}:00:00+05:30` });
  }

  const report = generateWeeklyReport(measurements, station, now);

  const day16h = report.dailyBreakdown.find(d => d.dateKey === '2026-11-09');
  const day15h = report.dailyBreakdown.find(d => d.dateKey === '2026-11-10');

  assert.ok(day16h);
  assert.strictEqual(day16h.distinctHours, 16);
  assert.strictEqual(day16h.coverageQuality, 'sufficient');
  assert.strictEqual(day16h.isCompliant, true);
  assert.strictEqual(day16h.complianceStatus, 'compliant');
  assert.ok(day16h.complianceLabel.includes('Compliant'));

  assert.ok(day15h);
  assert.strictEqual(day15h.distinctHours, 15);
  assert.strictEqual(day15h.coverageQuality, 'insufficient');
  assert.strictEqual(day15h.isCompliant, null, '15-hour day must have isCompliant: null');
  assert.strictEqual(day15h.complianceStatus, 'insufficient');
  assert.ok(day15h.complianceLabel.includes('Insufficient Data'));

  assert.strictEqual(report.summary.evaluableDaysCount, 1);
  assert.strictEqual(report.summary.insufficientDaysCount, 1);
});
