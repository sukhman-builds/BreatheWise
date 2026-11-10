import test from 'node:test';
import assert from 'node:assert';
import { buildCityLeaderboard } from '../src/utils/leaderboard.js';
import { SUPPORTED_CITIES, getDefaultStationForCity } from '../src/config/stations.js';

test('Leaderboard: Ranks reporting cities from cleanest to most polluted', () => {
  const ambalaStation = getDefaultStationForCity('Ambala');
  const delhiStation = getDefaultStationForCity('New Delhi');
  const jaipurStation = getDefaultStationForCity('Jaipur');
  const now = new Date('2026-11-10T12:00:00Z').getTime();

  const mockAirMap = {
    [ambalaStation.id]: {
      readings: [{
        pollutant: 'pm25',
        value: 42.0,
        datetime: { utc: new Date(now - 30 * 60 * 1000).toISOString() }
      }],
      fetchedAt: new Date(now - 10000).toISOString()
    },
    [delhiStation.id]: {
      readings: [{
        pollutant: 'pm25',
        value: 125.0,
        datetime: { utc: new Date(now - 45 * 60 * 1000).toISOString() }
      }],
      fetchedAt: new Date(now - 10000).toISOString()
    },
    [jaipurStation.id]: {
      readings: [{
        pollutant: 'pm25',
        value: 28.0,
        datetime: { utc: new Date(now - 15 * 60 * 1000).toISOString() }
      }],
      fetchedAt: new Date(now - 10000).toISOString()
    }
  };

  const board = buildCityLeaderboard(mockAirMap, now);

  assert.strictEqual(board.totalCities, SUPPORTED_CITIES.length);
  assert.strictEqual(board.currentReportingCount, 3);
  assert.strictEqual(board.staleCount, 0);
  assert.strictEqual(board.unavailableCount, SUPPORTED_CITIES.length - 3);

  // Jaipur (28.0) should be Rank #1
  assert.strictEqual(board.cities[0].cityName, 'Jaipur');
  assert.strictEqual(board.cities[0].rank, 1);
  assert.strictEqual(board.cities[0].pm25, 28.0);
  assert.strictEqual(board.cities[0].rankingStatus, 'current');

  // Ambala (42.0) should be Rank #2
  assert.strictEqual(board.cities[1].cityName, 'Ambala');
  assert.strictEqual(board.cities[1].rank, 2);
  assert.strictEqual(board.cities[1].pm25, 42.0);

  // Delhi (125.0) should be Rank #3
  assert.strictEqual(board.cities[2].cityName, 'New Delhi');
  assert.strictEqual(board.cities[2].rank, 3);
  assert.strictEqual(board.cities[2].pm25, 125.0);

  // Summary highlights
  assert.strictEqual(board.cleanestCity.cityName, 'Jaipur');
  assert.strictEqual(board.mostPollutedCity.cityName, 'New Delhi');

  // Metric disclaimer clarifies PM2.5, not AQI
  assert.ok(board.metricDisclaimer.includes('PM2.5'));
});

test('Leaderboard: Cities with stale observations (>3h) are excluded from current live rankings', () => {
  const ambalaStation = getDefaultStationForCity('Ambala');
  const delhiStation = getDefaultStationForCity('New Delhi');
  const now = new Date('2026-11-10T12:00:00Z').getTime();

  // Delhi has fresh reading (30m ago)
  // Ambala has stale reading (5 hours ago)
  const mockAirMap = {
    [delhiStation.id]: {
      readings: [{
        pollutant: 'pm25',
        value: 125.0,
        datetime: { utc: new Date(now - 30 * 60 * 1000).toISOString() }
      }],
      fetchedAt: new Date(now - 10000).toISOString(),
      isStale: false
    },
    [ambalaStation.id]: {
      readings: [{
        pollutant: 'pm25',
        value: 15.0, // Low number, but 5 hours old
        datetime: { utc: new Date(now - 5 * 3600000).toISOString() }
      }],
      fetchedAt: new Date(now - 10000).toISOString(),
      isStale: true
    }
  };

  const board = buildCityLeaderboard(mockAirMap, now);

  assert.strictEqual(board.currentReportingCount, 1);
  assert.strictEqual(board.staleCount, 1);

  // Only Delhi is in current ranking (#1)
  assert.strictEqual(board.cities[0].cityName, 'New Delhi');
  assert.strictEqual(board.cities[0].rank, 1);

  // Ambala is stale: must NOT have a rank number
  const ambalaEntry = board.cities.find(c => c.cityName === 'Ambala');
  assert.ok(ambalaEntry);
  assert.strictEqual(ambalaEntry.rank, null, 'Stale city must not have a sequential rank');
  assert.strictEqual(ambalaEntry.isStale, true);
  assert.strictEqual(ambalaEntry.rankingStatus, 'stale');

  // Ambala (15.0) must NOT be declared current cleanest city because its observation is stale!
  assert.strictEqual(board.cleanestCity.cityName, 'New Delhi');
});

test('Leaderboard: Unreported cities are placed at the bottom with null rank and never fabricated', () => {
  const board = buildCityLeaderboard({});

  assert.strictEqual(board.reportingCount, 0);
  assert.strictEqual(board.currentReportingCount, 0);
  assert.strictEqual(board.unavailableCount, SUPPORTED_CITIES.length);
  assert.strictEqual(board.cleanestCity, null);

  for (const city of board.cities) {
    assert.strictEqual(city.hasData, false);
    assert.strictEqual(city.pm25, null, 'Unreported cities must have null pm25, never 0');
    assert.strictEqual(city.rank, null);
    assert.strictEqual(city.rankingStatus, 'unavailable');
  }
});

test('Leaderboard Regression: Handles failed city requests across repeated rerenders without mutating or fabricating data', () => {
  const ambalaStation = getDefaultStationForCity('Ambala');
  const delhiStation = getDefaultStationForCity('New Delhi');
  const now = new Date('2026-11-10T12:00:00Z').getTime();

  // Initial state: Only Delhi succeeded; Ambala threw a network error (null in map)
  const initialMap = {
    [delhiStation.id]: {
      readings: [{
        pollutant: 'pm25',
        value: 120.0,
        datetime: { utc: new Date(now - 15 * 60 * 1000).toISOString() }
      }],
      fetchedAt: new Date(now - 5000).toISOString(),
      isStale: false
    },
    [ambalaStation.id]: null // Failed network request
  };

  // Render 1: Partial city failure
  const board1 = buildCityLeaderboard(initialMap, now);
  assert.strictEqual(board1.currentReportingCount, 1);
  assert.strictEqual(board1.cleanestCity.cityName, 'New Delhi');
  const ambalaEntry1 = board1.cities.find(c => c.cityName === 'Ambala');
  assert.strictEqual(ambalaEntry1.hasData, false);
  assert.strictEqual(ambalaEntry1.rank, null);
  assert.strictEqual(ambalaEntry1.rankingStatus, 'unavailable');

  // Simulate parent rerender: Parent passes a new object identity with Ambala still failed
  const rerenderMap = {
    ...initialMap,
    [ambalaStation.id]: undefined // Still rejected
  };

  const board2 = buildCityLeaderboard(rerenderMap, now);
  assert.strictEqual(board2.currentReportingCount, 1);
  assert.strictEqual(board2.cleanestCity.cityName, 'New Delhi');
  assert.strictEqual(board2.cities[0].rank, 1);

  // Now simulate subsequent update where Ambala recovers
  const recoveredMap = {
    ...rerenderMap,
    [ambalaStation.id]: {
      readings: [{
        pollutant: 'pm25',
        value: 45.0,
        datetime: { utc: new Date(now - 10 * 60 * 1000).toISOString() }
      }],
      fetchedAt: new Date(now - 1000).toISOString(),
      isStale: false
    }
  };

  const board3 = buildCityLeaderboard(recoveredMap, now);
  assert.strictEqual(board3.currentReportingCount, 2);
  // Ambala (45.0) should now be rank 1 and Delhi (120.0) rank 2
  assert.strictEqual(board3.cities[0].cityName, 'Ambala');
  assert.strictEqual(board3.cities[0].rank, 1);
  assert.strictEqual(board3.cities[1].cityName, 'New Delhi');
  assert.strictEqual(board3.cities[1].rank, 2);
  assert.strictEqual(board3.cleanestCity.cityName, 'Ambala');
});
