import test from 'node:test';
import assert from 'node:assert';
import {
  SUPPORTED_STATIONS,
  SUPPORTED_CITIES,
  DEFAULT_STATION_ID,
  getStationById,
  getStationsByCity,
  getDefaultStationForCity,
  getCityForStation
} from '../src/config/stations.js';

test('Station Configuration: Contains all 9 required verified cities', () => {
  const expectedCities = [
    'Ambala',
    'Amritsar',
    'Chandigarh',
    'Faridabad',
    'Gurugram',
    'Jaipur',
    'Ludhiana',
    'New Delhi',
    'Noida'
  ];

  for (const city of expectedCities) {
    assert.ok(SUPPORTED_CITIES.includes(city), `Missing required city: ${city}`);
    const stations = getStationsByCity(city);
    assert.ok(stations.length > 0, `City ${city} must have at least 1 verified station`);
  }
});

test('Station Configuration: Every station has valid required metadata', () => {
  const seenIds = new Set();

  for (const s of SUPPORTED_STATIONS) {
    assert.ok(typeof s.id === 'number' && s.id > 0, `Invalid ID: ${s.id}`);
    assert.ok(!seenIds.has(s.id), `Duplicate station ID: ${s.id}`);
    seenIds.add(s.id);

    assert.ok(typeof s.cityName === 'string' && s.cityName.length > 0, `Missing cityName for ID ${s.id}`);
    assert.ok(typeof s.name === 'string' && s.name.length > 0, `Missing name for ID ${s.id}`);
    assert.ok(typeof s.latitude === 'number' && s.latitude >= -90 && s.latitude <= 90, `Invalid latitude for ID ${s.id}`);
    assert.ok(typeof s.longitude === 'number' && s.longitude >= -180 && s.longitude <= 180, `Invalid longitude for ID ${s.id}`);
    assert.ok(typeof s.provider === 'string' && s.provider.length > 0, `Missing provider for ID ${s.id}`);
    assert.ok(typeof s.network === 'string' && s.network.length > 0, `Missing network for ID ${s.id}`);
    assert.ok(typeof s.pm25SensorId === 'number' && s.pm25SensorId > 0, `Invalid PM2.5 sensor ID for ${s.id}`);
    assert.ok(typeof s.sensors === 'object' && s.sensors !== null, `Sensors mapping required for ID ${s.id}`);
    assert.strictEqual(s.sensors.pm25, s.pm25SensorId, `pm25 sensor ID must match pm25SensorId for ID ${s.id}`);
  }
});

test('Station Configuration: Existing Delhi (8118) and Ambala (6964) preserved', () => {
  const delhi = getStationById(8118);
  assert.ok(delhi);
  assert.strictEqual(delhi.id, 8118);
  assert.strictEqual(delhi.cityName, 'New Delhi');
  assert.strictEqual(delhi.pm25SensorId, 23534);

  const ambala = getStationById(6964);
  assert.ok(ambala);
  assert.strictEqual(ambala.id, 6964);
  assert.strictEqual(ambala.cityName, 'Ambala');
  assert.strictEqual(ambala.pm25SensorId, 14258997);
});

test('Station Configuration: Multi-station cities support specific station selection', () => {
  // Chandigarh has 3 stations
  const chdStations = getStationsByCity('Chandigarh');
  assert.strictEqual(chdStations.length, 3);
  assert.ok(chdStations.some(s => s.id === 233415));
  assert.ok(chdStations.some(s => s.id === 10914));
  assert.ok(chdStations.some(s => s.id === 278418));

  // Jaipur has 3 stations
  const jaiStations = getStationsByCity('Jaipur');
  assert.strictEqual(jaiStations.length, 3);
  assert.ok(jaiStations.some(s => s.id === 5635));
  assert.ok(jaiStations.some(s => s.id === 5612));
  assert.ok(jaiStations.some(s => s.id === 5633));

  // New Delhi has 2 stations
  const delStations = getStationsByCity('New Delhi');
  assert.strictEqual(delStations.length, 2);
  assert.ok(delStations.some(s => s.id === 8118));
  assert.ok(delStations.some(s => s.id === 17));

  // Noida has 2 stations
  const noiStations = getStationsByCity('Noida');
  assert.strictEqual(noiStations.length, 2);
  assert.ok(noiStations.some(s => s.id === 5616));
  assert.ok(noiStations.some(s => s.id === 5598));
});

test('Station Configuration: Lookup helpers behave consistently', () => {
  assert.strictEqual(DEFAULT_STATION_ID, 8118);
  assert.strictEqual(getCityForStation(8118), 'New Delhi');
  assert.strictEqual(getCityForStation(6964), 'Ambala');
  assert.strictEqual(getCityForStation(233415), 'Chandigarh');
  assert.strictEqual(getCityForStation(5635), 'Jaipur');

  // Fallback for non-existent station ID returns default
  const fallback = getStationById(99999999);
  assert.ok(fallback);
  assert.strictEqual(fallback.id, SUPPORTED_STATIONS[0].id);

  // Default station for a city
  const ambalaDefault = getDefaultStationForCity('Ambala');
  assert.strictEqual(ambalaDefault.id, 6964);

  const chdDefault = getDefaultStationForCity('Chandigarh');
  assert.strictEqual(chdDefault.id, 233415);
});
