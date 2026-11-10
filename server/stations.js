// BreatheWise Centralized Supported Stations Configuration (Backend)
// Verified against OpenAQ v3 API with real ground-sensor observations

const SUPPORTED_STATIONS = [
  // 1. Ambala
  {
    id: 6964,
    city: 'Ambala',
    cityName: 'Ambala',
    name: 'Patti Mehar, Ambala - HSPCB',
    shortName: 'Patti Mehar',
    locality: 'Ambala, Haryana',
    state: 'Haryana',
    provider: 'CPCB',
    network: 'Haryana State Pollution Control Board (HSPCB)',
    latitude: 30.379589,
    longitude: 76.778328,
    pm25SensorId: 14258997,
    sensors: {
      pm25: 14258997,
      pm10: 14258996,
      no2: 14258994,
      so2: 14258999,
      co: 14258992,
      o3: 14258995
    },
    pinColor: '#00695c',
    pinLabel: 'AMB'
  },

  // 2. New Delhi - Station 1 (US Diplomatic Post)
  {
    id: 8118,
    city: 'New Delhi',
    cityName: 'New Delhi',
    name: 'New Delhi (US Diplomatic Post)',
    shortName: 'US Diplomatic Post',
    locality: 'Chanakyapuri, Central Delhi, NCR',
    state: 'Delhi',
    provider: 'AirNow',
    network: 'U.S. Diplomatic Post monitor via AirNow',
    latitude: 28.63576,
    longitude: 77.22445,
    pm25SensorId: 23534,
    sensors: {
      pm25: 23534
    },
    pinColor: '#1b5e20',
    pinLabel: 'DEL'
  },

  // 2. New Delhi - Station 2 (R K Puram - DPCC)
  {
    id: 17,
    city: 'New Delhi',
    cityName: 'New Delhi',
    name: 'R K Puram, Delhi - DPCC',
    shortName: 'R K Puram',
    locality: 'R K Puram, South West Delhi, NCR',
    state: 'Delhi',
    provider: 'CPCB',
    network: 'Delhi Pollution Control Committee (DPCC)',
    latitude: 28.563262,
    longitude: 77.186937,
    pm25SensorId: 12234787,
    sensors: {
      pm25: 12234787,
      pm10: 12234786,
      no2: 12234784,
      so2: 12234789,
      co: 12234782,
      o3: 12234785
    },
    pinColor: '#2e7d32',
    pinLabel: 'RKP'
  },

  // 3. Chandigarh - Station 1 (Sector 22)
  {
    id: 233415,
    city: 'Chandigarh',
    cityName: 'Chandigarh',
    name: 'Sector 22, Chandigarh - CPCC',
    shortName: 'Sector 22',
    locality: 'Sector 22, Chandigarh',
    state: 'Chandigarh',
    provider: 'CPCB',
    network: 'Chandigarh Pollution Control Committee (CPCC)',
    latitude: 30.735567,
    longitude: 76.775714,
    pm25SensorId: 12236806,
    sensors: {
      pm25: 12236806,
      pm10: 12236805,
      no2: 12236803,
      so2: 12236808,
      co: 12236801,
      o3: 12236804
    },
    pinColor: '#0277bd',
    pinLabel: 'S22'
  },

  // 3. Chandigarh - Station 2 (Sector 25)
  {
    id: 10914,
    city: 'Chandigarh',
    cityName: 'Chandigarh',
    name: 'Sector-25, Chandigarh - CPCC',
    shortName: 'Sector 25',
    locality: 'Sector 25, Chandigarh',
    state: 'Chandigarh',
    provider: 'CPCB',
    network: 'Chandigarh Pollution Control Committee (CPCC)',
    latitude: 30.751462,
    longitude: 76.762879,
    pm25SensorId: 12235976,
    sensors: {
      pm25: 12235976,
      pm10: 12235975,
      no2: 12235973,
      so2: 12235978,
      co: 12235971,
      o3: 12235974
    },
    pinColor: '#0288d1',
    pinLabel: 'S25'
  },

  // 3. Chandigarh - Station 3 (Sector 53)
  {
    id: 278418,
    city: 'Chandigarh',
    cityName: 'Chandigarh',
    name: 'Sector-53, Chandigarh - CPCC',
    shortName: 'Sector 53',
    locality: 'Sector 53, Chandigarh',
    state: 'Chandigarh',
    provider: 'CPCB',
    network: 'Chandigarh Pollution Control Committee (CPCC)',
    latitude: 30.719859,
    longitude: 76.738637,
    pm25SensorId: 12237008,
    sensors: {
      pm25: 12237008,
      pm10: 12237007,
      no2: 12237005,
      so2: 12237010,
      co: 12237003,
      o3: 12237006
    },
    pinColor: '#039be5',
    pinLabel: 'S53'
  },

  // 4. Gurugram
  {
    id: 301,
    city: 'Gurugram',
    cityName: 'Gurugram',
    name: 'Vikas Sadan, Gurugram - HSPCB',
    shortName: 'Vikas Sadan',
    locality: 'Vikas Sadan, Gurugram, Haryana',
    state: 'Haryana',
    provider: 'CPCB',
    network: 'Haryana State Pollution Control Board (HSPCB)',
    latitude: 28.450124,
    longitude: 77.026305,
    pm25SensorId: 14258988,
    sensors: {
      pm25: 14258988,
      pm10: 14258987,
      no2: 14258985,
      so2: 14258990,
      co: 14258983,
      o3: 14258986
    },
    pinColor: '#e65100',
    pinLabel: 'GUR'
  },

  // 5. Faridabad
  {
    id: 5617,
    city: 'Faridabad',
    cityName: 'Faridabad',
    name: 'Sector-16A, Faridabad - HSPCB',
    shortName: 'Sector 16A',
    locality: 'Sector 16A, Faridabad, Haryana',
    state: 'Haryana',
    provider: 'CPCB',
    network: 'Haryana State Pollution Control Board (HSPCB)',
    latitude: 28.408842,
    longitude: 77.309908,
    pm25SensorId: 14930,
    sensors: {
      pm25: 14930,
      pm10: 17547,
      no2: 14887,
      so2: 15107,
      co: 17865,
      o3: 15229
    },
    pinColor: '#ad1457',
    pinLabel: 'FAR'
  },

  // 6. Noida - Station 1 (Sector 62 - IMD)
  {
    id: 5616,
    city: 'Noida',
    cityName: 'Noida',
    name: 'Sector - 62, Noida, UP - IMD',
    shortName: 'Sector 62',
    locality: 'Sector 62, Noida, Uttar Pradesh',
    state: 'Uttar Pradesh',
    provider: 'CPCB',
    network: 'India Meteorological Department (IMD) / CPCB',
    latitude: 28.624548,
    longitude: 77.357710,
    pm25SensorId: 12234720,
    sensors: {
      pm25: 12234720,
      pm10: 12234719,
      no2: 12234717,
      co: 12234715,
      o3: 12234718
    },
    pinColor: '#4527a0',
    pinLabel: 'N62'
  },

  // 6. Noida - Station 2 (Sector 125 - UPPCB)
  {
    id: 5598,
    city: 'Noida',
    cityName: 'Noida',
    name: 'Sector - 125, Noida, UP - UPPCB',
    shortName: 'Sector 125',
    locality: 'Sector 125, Noida, Uttar Pradesh',
    state: 'Uttar Pradesh',
    provider: 'CPCB',
    network: 'Uttar Pradesh Pollution Control Board (UPPCB)',
    latitude: 28.544761,
    longitude: 77.323126,
    pm25SensorId: 12235187,
    sensors: {
      pm25: 12235187,
      pm10: 12235186,
      no2: 12235184,
      so2: 12235189,
      co: 12235182,
      o3: 12235185
    },
    pinColor: '#512da8',
    pinLabel: 'N125'
  },

  // 7. Amritsar
  {
    id: 5551,
    city: 'Amritsar',
    cityName: 'Amritsar',
    name: 'Golden Temple, Amritsar - PPCB',
    shortName: 'Golden Temple',
    locality: 'Amritsar, Punjab',
    state: 'Punjab',
    provider: 'CPCB',
    network: 'Punjab Pollution Control Board (PPCB)',
    latitude: 31.62,
    longitude: 74.876512,
    pm25SensorId: 12235443,
    sensors: {
      pm25: 12235443,
      pm10: 12235442,
      no2: 12235440,
      so2: 12235445,
      co: 12235438,
      o3: 12235441
    },
    pinColor: '#f57f17',
    pinLabel: 'ASR'
  },

  // 8. Ludhiana
  {
    id: 5569,
    city: 'Ludhiana',
    cityName: 'Ludhiana',
    name: 'Punjab Agricultural University, Ludhiana - PPCB',
    shortName: 'PAU',
    locality: 'Ludhiana, Punjab',
    state: 'Punjab',
    provider: 'CPCB',
    network: 'Punjab Pollution Control Board (PPCB)',
    latitude: 30.9028,
    longitude: 75.8086,
    pm25SensorId: 12235426,
    sensors: {
      pm25: 12235426,
      pm10: 12235425,
      no2: 12235423,
      so2: 12235428,
      co: 12235421,
      o3: 12235424
    },
    pinColor: '#c2185b',
    pinLabel: 'LDH'
  },

  // 9. Jaipur - Station 1 (Adarsh Nagar)
  {
    id: 5635,
    city: 'Jaipur',
    cityName: 'Jaipur',
    name: 'Adarsh Nagar, Jaipur - RSPCB',
    shortName: 'Adarsh Nagar',
    locality: 'Adarsh Nagar, Jaipur, Rajasthan',
    state: 'Rajasthan',
    provider: 'CPCB',
    network: 'Rajasthan State Pollution Control Board (RSPCB)',
    latitude: 26.902909,
    longitude: 75.836858,
    pm25SensorId: 12234850,
    sensors: {
      pm25: 12234850,
      pm10: 12234849,
      no2: 12234847,
      so2: 12234851,
      co: 12234845,
      o3: 12234848
    },
    pinColor: '#d84315',
    pinLabel: 'JAI-A'
  },

  // 9. Jaipur - Station 2 (Shastri Nagar)
  {
    id: 5612,
    city: 'Jaipur',
    cityName: 'Jaipur',
    name: 'Shastri Nagar, Jaipur - RSPCB',
    shortName: 'Shastri Nagar',
    locality: 'Shastri Nagar, Jaipur, Rajasthan',
    state: 'Rajasthan',
    provider: 'CPCB',
    network: 'Rajasthan State Pollution Control Board (RSPCB)',
    latitude: 26.950293,
    longitude: 75.730943,
    pm25SensorId: 12234876,
    sensors: {
      pm25: 12234876,
      pm10: 12234875,
      no2: 12234873,
      so2: 12234878,
      co: 12234871,
      o3: 12234874
    },
    pinColor: '#bf360c',
    pinLabel: 'JAI-S'
  },

  // 9. Jaipur - Station 3 (Police Commissionerate)
  {
    id: 5633,
    city: 'Jaipur',
    cityName: 'Jaipur',
    name: 'Police Commissionerate, Jaipur - RSPCB',
    shortName: 'Police Comm.',
    locality: 'Jaipur, Rajasthan',
    state: 'Rajasthan',
    provider: 'CPCB',
    network: 'Rajasthan State Pollution Control Board (RSPCB)',
    latitude: 26.916409,
    longitude: 75.799490,
    pm25SensorId: 12234805,
    sensors: {
      pm25: 12234805,
      pm10: 12234804,
      no2: 12234802,
      so2: 12234807,
      co: 12234800,
      o3: 12234803
    },
    pinColor: '#e64a19',
    pinLabel: 'JAI-P'
  }
];

const DEFAULT_STATION_ID = 8118;

const SUPPORTED_CITIES = Array.from(
  new Set(SUPPORTED_STATIONS.map(s => s.cityName))
).sort();

function getStationById(id) {
  const numericId = Number(id);
  return SUPPORTED_STATIONS.find(s => s.id === numericId) || SUPPORTED_STATIONS[0];
}

function getStationsByCity(cityName) {
  if (!cityName) return [];
  const normalized = cityName.trim().toLowerCase();
  return SUPPORTED_STATIONS.filter(
    s => s.cityName.toLowerCase() === normalized || s.city.toLowerCase() === normalized
  );
}

function getDefaultStationForCity(cityName) {
  const stations = getStationsByCity(cityName);
  return stations[0] || getStationById(DEFAULT_STATION_ID);
}

function getCityForStation(id) {
  const station = getStationById(id);
  return station ? station.cityName : 'New Delhi';
}

module.exports = {
  SUPPORTED_STATIONS,
  SUPPORTED_CITIES,
  DEFAULT_STATION_ID,
  getStationById,
  getStationsByCity,
  getDefaultStationForCity,
  getCityForStation
};
