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
});
