import test from 'node:test';
import assert from 'node:assert';
import { findCleanAirWindow } from '../src/utils/cleanAirWindow.js';

test('Clean Air Window: Empty and missing forecast data handled gracefully', () => {
  const emptyRes = findCleanAirWindow([]);
  assert.strictEqual(emptyRes.available, false);
  assert.ok(emptyRes.reason.includes('unavailable'));
  assert.strictEqual(emptyRes.isForecast, true);

  const nullRes = findCleanAirWindow(null);
  assert.strictEqual(nullRes.available, false);

  const nonArrayRes = findCleanAirWindow('invalid');
  assert.strictEqual(nonArrayRes.available, false);
});

test('Clean Air Window: Accurately identifies cleanest 3-hour contiguous window without unmeasured meteorological claims', () => {
  const now = new Date('2026-11-10T08:00:00Z').getTime();

  // Create 12 hours of forecast data with a clear cleanest dip between 14:00 and 17:00
  const forecast = [
    { time: '2026-11-10T08:00:00Z', pm25: 110, usAqi: 178 },
    { time: '2026-11-10T09:00:00Z', pm25: 95, usAqi: 171 },
    { time: '2026-11-10T10:00:00Z', pm25: 85, usAqi: 166 },
    { time: '2026-11-10T11:00:00Z', pm25: 75, usAqi: 161 },
    { time: '2026-11-10T12:00:00Z', pm25: 55, usAqi: 151 },
    { time: '2026-11-10T13:00:00Z', pm25: 38, usAqi: 107 },
    { time: '2026-11-10T14:00:00Z', pm25: 25, usAqi: 78 }, // Window: 25, 22, 28 (avg 25.0)
    { time: '2026-11-10T15:00:00Z', pm25: 22, usAqi: 72 },
    { time: '2026-11-10T16:00:00Z', pm25: 28, usAqi: 84 },
    { time: '2026-11-10T17:00:00Z', pm25: 60, usAqi: 153 },
    { time: '2026-11-10T18:00:00Z', pm25: 90, usAqi: 169 },
    { time: '2026-11-10T19:00:00Z', pm25: 130, usAqi: 189 }
  ];

  const result = findCleanAirWindow(forecast, { nowTimestamp: now, windowHours: 3 });

  assert.strictEqual(result.available, true);
  assert.strictEqual(result.avgPm25, 25.0);
  assert.strictEqual(result.avgUsAqi, 78);
  assert.strictEqual(result.category.label, 'Good');
  assert.strictEqual(result.startTime, '2026-11-10T14:00:00Z');
  assert.strictEqual(result.isForecast, true);
  assert.ok(result.disclaimer.includes('Open-Meteo'));

  // Explanation must use available forecast data, NOT unmeasured meteorological assertions
  assert.ok(result.explanation.includes('25 µg/m³') || result.explanation.includes('25.0'));
  assert.strictEqual(result.explanation.includes('boundary layer'), false, 'Must not claim boundary layer without meteorological inputs');
  assert.strictEqual(result.explanation.includes('commuter traffic'), false, 'Must not assert commuter traffic without traffic inputs');
  assert.strictEqual(result.explanation.includes('wind'), false, 'Must not assert wind without wind inputs');
});

test('Clean Air Window: Null and missing values are never treated as 0', () => {
  const now = new Date('2026-11-10T08:00:00Z').getTime();

  // Point with null pm25 must not become 0
  const forecastWithNulls = [
    { time: '2026-11-10T09:00:00Z', pm25: null, usAqi: null },
    { time: '2026-11-10T10:00:00Z', pm25: 50, usAqi: 137 },
    { time: '2026-11-10T11:00:00Z', pm25: 60, usAqi: 153 }
  ];

  const result = findCleanAirWindow(forecastWithNulls, { nowTimestamp: now, windowHours: 2 });
  assert.strictEqual(result.available, true);
  assert.strictEqual(result.avgPm25, 55.0, 'Average of 50 and 60 must be 55, not lowered by null');
});

test('Clean Air Window: Discards expired past forecast hours', () => {
  const now = new Date('2026-11-10T14:00:00Z').getTime();

  // All hours are in the past
  const pastForecast = [
    { time: '2026-11-10T06:00:00Z', pm25: 20 },
    { time: '2026-11-10T07:00:00Z', pm25: 22 },
    { time: '2026-11-10T08:00:00Z', pm25: 24 }
  ];

  const result = findCleanAirWindow(pastForecast, { nowTimestamp: now });
  assert.strictEqual(result.available, false);
  assert.ok(result.reason.includes('No upcoming'));
});
