import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './App.css';
import { API_BASE_URL } from './config';
import { calculate24HourStats, getSnapshotAdvisory, formatDateTime, getTimeAgo } from './utils/pm25Standards';

import CompareView from './components/CompareView';
import TrendsView from './components/TrendsView';
import MapView from './components/MapView';
import HealthView from './components/HealthView';
import ForecastView from './components/ForecastView';

// Standard pollutants definition
const pollutants = [
  { name: 'PM2.5', key: 'pm25', description: 'Fine inhalable particles (<2.5 µm)' },
  { name: 'PM10', key: 'pm10', description: 'Coarse inhalable particles (<10 µm)' },
  { name: 'NO₂', key: 'no2', description: 'Nitrogen dioxide from fossil fuels' },
  { name: 'SO₂', key: 'so2', description: 'Sulphur dioxide from power/industry' },
  { name: 'CO', key: 'co', description: 'Carbon monoxide from incomplete burn' },
  { name: 'O₃', key: 'o3', description: 'Ground-level photochemical ozone' },
];

// Custom marker pins for Leaflet
function createPin(color, label) {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        box-shadow: 0 3px 8px rgba(0,0,0,0.3);
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-size: 10px;
          font-weight: 800;
          font-family: sans-serif;
        ">${label}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
}

const pinDelhi = createPin('#1b5e20', 'DEL');
const pinAmbala = createPin('#00695c', 'AMB');

export default function App() {
  const [activeNav, setActiveNav] = useState(() => {
    try {
      const param = new URLSearchParams(window.location.search).get('tab');
      if (param && ['overview', 'map', 'trends', 'compare', 'health', 'forecast'].includes(param)) {
        return param;
      }
    } catch {
      // fallback
    }
    return 'overview';
  }); // overview | map | trends | compare | health | forecast
  const [selectedLocationId, setSelectedLocationId] = useState(8118); // 8118 (Delhi) or 6964 (Ambala)

  // Current timestamp stored in state to strictly honor React 19 pure component rules
  const [now, setNow] = useState(() => Date.now());

  // Data states
  const [delhiAir, setDelhiAir] = useState(null);
  const [ambalaAir, setAmbalaAir] = useState(null);
  const [delhiLocation, setDelhiLocation] = useState(null);
  const [ambalaLocation, setAmbalaLocation] = useState(null);
  const [ambalaDiscovery, setAmbalaDiscovery] = useState(null);

  // History state for overview quick chart
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');

  // Status states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rateLimitCountdown, setRateLimitCountdown] = useState(null);

  // Update current time clock every 60s
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Fetch verified stations and air quality
  const fetchAllData = async () => {
    try {
      const [delhiAqRes, ambalaAqRes, delhiLocRes, ambalaLocRes, ambalaStationsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/air-quality/8118`),
        fetch(`${API_BASE_URL}/api/air-quality/6964`),
        fetch(`${API_BASE_URL}/api/location/8118`),
        fetch(`${API_BASE_URL}/api/location/6964`),
        fetch(`${API_BASE_URL}/api/ambala-stations`)
      ]);

      if (delhiAqRes.status === 429 || ambalaAqRes.status === 429) {
        setRateLimitCountdown(30);
        throw new Error('Rate limit encountered on OpenAQ. Automatic retry in 30 seconds.');
      }

      if (!delhiAqRes.ok && !ambalaAqRes.ok) {
        throw new Error('Unable to connect to BreatheWise backend API.');
      }

      const [delhiAq, ambalaAq, delhiLoc, ambalaLoc, ambalaDisc] = await Promise.all([
        delhiAqRes.ok ? delhiAqRes.json() : null,
        ambalaAqRes.ok ? ambalaAqRes.json() : null,
        delhiLocRes.ok ? delhiLocRes.json() : null,
        ambalaLocRes.ok ? ambalaLocRes.json() : null,
        ambalaStationsRes.ok ? ambalaStationsRes.json() : null
      ]);

      setDelhiAir(delhiAq);
      setAmbalaAir(ambalaAq);
      setDelhiLocation(delhiLoc);
      setAmbalaLocation(ambalaLoc);
      setAmbalaDiscovery(ambalaDisc);
      setError('');

    } catch (err) {
      setError(err.message || 'Error communicating with backend API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function initialLoad() {
      try {
        const [delhiAqRes, ambalaAqRes, delhiLocRes, ambalaLocRes, ambalaStationsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/air-quality/8118`),
          fetch(`${API_BASE_URL}/api/air-quality/6964`),
          fetch(`${API_BASE_URL}/api/location/8118`),
          fetch(`${API_BASE_URL}/api/location/6964`),
          fetch(`${API_BASE_URL}/api/ambala-stations`)
        ]);

        if (delhiAqRes.status === 429 || ambalaAqRes.status === 429) {
          if (isMounted) setRateLimitCountdown(30);
          throw new Error('Rate limit encountered on OpenAQ. Automatic retry in 30 seconds.');
        }

        const [delhiAq, ambalaAq, delhiLoc, ambalaLoc, ambalaDisc] = await Promise.all([
          delhiAqRes.ok ? delhiAqRes.json() : null,
          ambalaAqRes.ok ? ambalaAqRes.json() : null,
          delhiLocRes.ok ? delhiLocRes.json() : null,
          ambalaLocRes.ok ? ambalaLocRes.json() : null,
          ambalaStationsRes.ok ? ambalaStationsRes.json() : null
        ]);

        if (!isMounted) return;
        setDelhiAir(delhiAq);
        setAmbalaAir(ambalaAq);
        setDelhiLocation(delhiLoc);
        setAmbalaLocation(ambalaLoc);
        setAmbalaDiscovery(ambalaDisc);
        setError('');
      } catch (err) {
        if (isMounted) setError(err.message || 'Error communicating with backend API.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initialLoad();
    return () => { isMounted = false; };
  }, []);

  // Fetch historical data when selected location changes
  const activeSensorId = selectedLocationId === 8118 ? 23534 : 14258997;

  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/history/${activeSensorId}`);
        if (!response.ok) {
          throw new Error('Unable to fetch historical measurements');
        }
        const data = await response.json();
        if (!isMounted) return;
        setHistory(data.measurements || []);
        setHistoryError('');
      } catch (err) {
        if (isMounted) setHistoryError(err.message);
      } finally {
        if (isMounted) setHistoryLoading(false);
      }
    }

    loadHistory();
    return () => { isMounted = false; };
  }, [activeSensorId]);

  // Handle rate limit countdown
  useEffect(() => {
    if (rateLimitCountdown === null || rateLimitCountdown <= 0) return;
    const timer = setTimeout(() => {
      if (rateLimitCountdown === 1) {
        setRateLimitCountdown(null);
        fetchAllData();
      } else {
        setRateLimitCountdown(rateLimitCountdown - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [rateLimitCountdown]);

  // Current active station data
  const currentAir = selectedLocationId === 8118 ? delhiAir : ambalaAir;
  const currentLocation = selectedLocationId === 8118 ? delhiLocation : ambalaLocation;
  const currentStationName = selectedLocationId === 8118
    ? (delhiLocation?.name || 'New Delhi (US Diplomatic Post)')
    : (ambalaLocation?.name || 'Patti Mehar, Ambala - HSPCB');

  const readings = currentAir?.readings || [];
  const pm25 = readings.find(item => item.pollutant === 'pm25');
  const measurementTime = pm25?.datetime?.local || pm25?.datetime?.utc;
  const fetchTime = currentAir?.fetchedAt;

  // Stale measurement calculation using pure state timestamp
  const ageHours = measurementTime
    ? (now - new Date(measurementTime).getTime()) / 3600000
    : null;
  const isStale = ageHours !== null && ageHours > 3;

  const pm25Snapshot = getSnapshotAdvisory(pm25?.value);
  const stats24h = calculate24HourStats(history, now);

  // Calculate dynamic greeting based on Indian Standard Time (IST)
  const istHour = (() => {
    try {
      const timeStr = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hour12: false
      }).format(new Date(now));
      return parseInt(timeStr, 10);
    } catch {
      return 12;
    }
  })();

  const greeting = istHour >= 4 && istHour < 12
    ? 'Good morning'
    : istHour >= 12 && istHour < 17
      ? 'Good afternoon'
      : 'Good evening';

  // Chart data: 24 available readings
  const chartData = [...history]
    .filter(item => item.value !== null && Number.isFinite(Number(item.value)))
    .slice(0, 24)
    .reverse();

  const maxValue = Math.max(...chartData.map(item => Number(item.value)), 1);
  const latestHistory = history[0];

  return (
    <div className="app">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">✳</span>
          <span>BreatheWise</span>
        </div>

        <p className="menu-label">WORKSPACE</p>

        <nav>
          <button
            type="button"
            className={`nav-item ${activeNav === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveNav('overview')}
          >
            ▦ Overview
          </button>
          <button
            type="button"
            className={`nav-item ${activeNav === 'map' ? 'active' : ''}`}
            onClick={() => setActiveNav('map')}
          >
            ⌖ Air Quality Map
          </button>
          <button
            type="button"
            className={`nav-item ${activeNav === 'trends' ? 'active' : ''}`}
            onClick={() => setActiveNav('trends')}
          >
            ▤ Historical Trends
          </button>
          <button
            type="button"
            className={`nav-item ${activeNav === 'compare' ? 'active' : ''}`}
            onClick={() => setActiveNav('compare')}
          >
            ⇄ Compare Cities
          </button>
          <button
            type="button"
            className={`nav-item ${activeNav === 'health' ? 'active' : ''}`}
            onClick={() => setActiveNav('health')}
          >
            ♡ Health & Safety
          </button>
          <button
            type="button"
            className={`nav-item ${activeNav === 'forecast' ? 'active' : ''}`}
            onClick={() => setActiveNav('forecast')}
          >
            ☼ Forecast
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="api-status-row">
            <span
              className="live-dot"
              style={{
                backgroundColor: loading ? '#e7bd62' : error ? '#ef5350' : '#4caf50'
              }}
            ></span>
            <span>{loading ? 'Syncing OpenAQ...' : error ? 'API Issue' : 'Live Data Connected'}</span>
          </div>
          <p>Verified ground observations from OpenAQ v3</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div>
            <p className="eyebrow">AIR QUALITY INTELLIGENCE</p>
            <h1>{greeting} 🌿</h1>
            <p className="subtitle">Welcome to BreatheWise · Real ground observations. Objective data. Evidence-based health guidance.</p>
          </div>

          {/* Topbar Station Selector */}
          <div className="station-selector-header">
            <span className="location-pin-icon">📍</span>
            <div className="station-select-wrap">
              <label htmlFor="stationSelect" className="selector-label">MONITORING SITE:</label>
              <select
                id="stationSelect"
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(Number(e.target.value))}
                className="station-dropdown"
              >
                <option value={8118}>New Delhi (ID: 8118 · Provider: AirNow / U.S. Diplomatic Post)</option>
                <option value={6964}>
                  Ambala (ID: 6964 · Patti Mehar · Provider: CPCB / HSPCB {ambalaDiscovery ? '· Within 25 km' : ''})
                </option>
              </select>
            </div>
          </div>
        </header>

        {/* Rate Limit Banner */}
        {rateLimitCountdown !== null && (
          <div className="rate-limit-banner">
            <span>⏳ OpenAQ API rate limit reached. Re-querying in {rateLimitCountdown} seconds...</span>
            <button className="btn-sm" onClick={() => { setRateLimitCountdown(null); fetchAllData(); }}>
              Retry Now
            </button>
          </div>
        )}

        {/* Global Error Banner */}
        {error && rateLimitCountdown === null && (
          <div className="error-banner">
            <span>⚠ {error}</span>
            <button className="btn-retry-sm" onClick={fetchAllData}>Retry Connection</button>
          </div>
        )}

        {/* Render Active View */}
        {activeNav === 'overview' && (
          <>
            {/* Welcome Banner */}
            <section className="welcome-banner">
              <div>
                <p className="banner-label">EVIDENCE-BASED AIR QUALITY INTELLIGENCE</p>
                <h2>Breathe better.<br />Live informed.</h2>
                <p>
                  Explore verified physical measurements from ground-level ambient monitors.
                  Track real-world historical particulate concentrations and evaluate personal health guidance.
                </p>
              </div>
              <div className="banner-art">🌍</div>
            </section>

            {/* Current Air Quality Card */}
            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>Current Air Quality: {currentStationName}</h2>
                  <p>Observational PM2.5 mass concentration reported by ground sensor</p>
                </div>
                <div className="tags-group">
                  {isStale && <span className="status-tag stale-tag">OLDER MEASUREMENT (&gt;3H)</span>}
                  <span className="status-tag">
                    {loading ? 'LOADING' : error ? 'API ERROR' : 'OPENAQ VERIFIED'}
                  </span>
                </div>
              </div>

              <div className="aqi-card">
                <p className="card-label">PHYSICAL PM2.5 MASS CONCENTRATION & 24-HOUR ROLLING AVERAGE</p>

                {loading ? (
                  <div className="card-loading-state">
                    <div className="spinner"></div>
                    <h2>Loading sensor observations...</h2>
                  </div>
                ) : error ? (
                  <div className="card-error-state">
                    <h3>{error}</h3>
                  </div>
                ) : pm25 ? (
                  <>
                    {/* Dual Metric Presentation: 24h Average & Latest Observation */}
                    <div className="dual-metric-row">
                      {/* 24-Hour Rolling Average */}
                      <div className="metric-primary-block">
                        <div className="metric-primary-header">
                          <div className="metric-primary-info">
                            <span className="metric-sublabel">24-HOUR ROLLING AVERAGE</span>
                            <div
                              className="aqi-value"
                              style={{
                                color: (stats24h.hasData && stats24h.coverageQuality !== 'insufficient')
                                  ? stats24h.category.color
                                  : '#666'
                              }}
                            >
                              {stats24h.hasData && stats24h.average !== null ? stats24h.average : '—'}
                              <span className="val-unit">µg/m³</span>
                            </div>

                            <div
                              className="category-badge-inline"
                              style={{
                                backgroundColor: (stats24h.hasData && stats24h.coverageQuality !== 'insufficient')
                                  ? stats24h.category.bgColor
                                  : '#f5f5f5',
                                color: (stats24h.hasData && stats24h.coverageQuality !== 'insufficient')
                                  ? stats24h.category.color
                                  : '#666',
                                borderColor: (stats24h.hasData && stats24h.coverageQuality !== 'insufficient')
                                  ? stats24h.category.borderColor
                                  : '#ddd'
                              }}
                            >
                              {stats24h.hasData && stats24h.coverageQuality !== 'insufficient'
                                ? `${stats24h.category.label} — ${stats24h.statusLabel}`
                                : stats24h.statusLabel}
                            </div>
                          </div>

                          <div
                            className="aqi-circle"
                            style={{
                              borderColor: (stats24h.hasData && stats24h.coverageQuality !== 'insufficient')
                                ? stats24h.category.borderColor
                                : '#9e9e9e',
                              color: (stats24h.hasData && stats24h.coverageQuality !== 'insufficient')
                                ? stats24h.category.color
                                : '#757575'
                            }}
                          >
                            <span>PM</span>
                            <small>2.5</small>
                            <span className="circle-sub">
                              {stats24h.hasData && stats24h.coverageQuality !== 'insufficient' ? '24h Avg' : 'No 24h Data'}
                            </span>
                          </div>
                        </div>

                        <p className="coverage-detail-text">
                          ℹ {stats24h.statusDescription}
                        </p>
                      </div>

                      {/* Latest Single Observation */}
                      <div className="metric-snapshot-block">
                        <div>
                          <span className="metric-sublabel">LATEST SINGLE READING (SNAPSHOT)</span>
                          <div className="snapshot-value-row">
                            <div className="snapshot-value">
                              {pm25.value} <span className="snapshot-unit">µg/m³</span>
                            </div>
                            <div
                              className="category-badge-inline snapshot-badge"
                              style={{
                                backgroundColor: pm25Snapshot.bgColor,
                                color: pm25Snapshot.color,
                                borderColor: pm25Snapshot.borderColor
                              }}
                            >
                              {pm25Snapshot.label}
                            </div>
                          </div>
                        </div>

                        <div className="snapshot-meta-box">
                          <div className="snapshot-time-row">
                            <span className="snapshot-time-label">Observed:</span>
                            <span className="snapshot-time-val">
                              {formatDateTime(measurementTime)}
                              {measurementTime && (
                                <span className="t-relative"> ({getTimeAgo(measurementTime, now)})</span>
                              )}
                            </span>
                          </div>
                          <p className="snapshot-caveat">
                            * {pm25Snapshot.disclaimer}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Scientific Protocol Notice */}
                    <div className="scientific-rule-box">
                      <span className="rule-icon">⚖</span>
                      <p>
                        <strong>Scientific Protocol Notice:</strong> Official CPCB NAAQS concentration categories
                        (e.g. Good, Poor, Very Poor) are evaluated against a <strong>24-hour mean</strong>.
                        A single instantaneous spike or dip does not constitute a confirmed standard category.
                        PM2.5 mass concentration (µg/m³) is a physical density metric, distinct from the composite Air Quality Index (AQI).
                      </p>
                    </div>

                    {/* Distinct Measurement and Fetch Timestamps */}
                    <div className="timestamp-metrics">
                      <div className="timestamp-item">
                        <span className="t-label">Sensor Measurement Time:</span>
                        <strong className="t-val">{formatDateTime(measurementTime)}</strong>
                        {measurementTime && (
                          <span className="t-relative">({getTimeAgo(measurementTime, now)})</span>
                        )}
                      </div>

                      <div className="timestamp-item">
                        <span className="t-label">BreatheWise Proxy Fetch Time:</span>
                        <strong className="t-val">{formatDateTime(fetchTime)}</strong>
                        <span className="t-relative">(Cached upstream)</span>
                      </div>
                    </div>

                    {isStale && (
                      <div className="stale-alert-box">
                        <span>⏱</span>
                        <span>Notice: This measurement was recorded over 3 hours ago. Ambient conditions may have evolved.</span>
                      </div>
                    )}
                  </>
                ) : (
                  <h3>No PM2.5 measurement currently available for this site</h3>
                )}
              </div>
            </section>

            {/* Pollutant Levels Grid */}
            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>Station Pollutant Levels</h2>
                  <p>Measurements reported across all active sensors for {currentStationName}</p>
                </div>
              </div>

              <div className="pollutant-grid">
                {pollutants.map(item => {
                  const reading = readings.find(data => data.pollutant === item.key);

                  return (
                    <div className="pollutant-card" key={item.key}>
                      <span className="pollutant-name">{item.name}</span>

                      <h3>
                        {loading ? '...' : reading ? reading.value : '—'}
                      </h3>

                      <p>{item.description}</p>

                      <small>
                        {loading
                          ? 'Loading'
                          : reading
                            ? `${reading.unit} · Active Sensor`
                            : 'Sensor not reported'}
                      </small>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Historical PM2.5 Trends Panel */}
            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>Recent PM2.5 Timeline: {currentStationName}</h2>
                  <p>Chronological measurements from sensor {activeSensorId}</p>
                </div>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => setActiveNav('trends')}
                >
                  View Full Trends & Analytics →
                </button>
              </div>

              <div className="panel history-panel">
                {historyLoading ? (
                  <p>Loading historical observations...</p>
                ) : historyError ? (
                  <p>{historyError}</p>
                ) : chartData.length === 0 ? (
                  <p>No historical measurements available for this station.</p>
                ) : (
                  <>
                    <div className="history-summary">
                      <div>
                        <p className="muted">Latest recorded reading</p>
                        <h2>{latestHistory?.value} µg/m³</h2>
                      </div>
                      <div>
                        <p className="muted">Available data points</p>
                        <h2>{history.length}</h2>
                      </div>
                      <div>
                        <p className="muted">Data Fetch Timestamp</p>
                        <h2>{formatDateTime(fetchTime)}</h2>
                      </div>
                    </div>

                    <div className="history-chart">
                      {chartData.map((item, index) => {
                        const val = Number(item.value);
                        const dateObj = new Date(item.datetime);
                        const hour = isNaN(dateObj.getTime())
                          ? index
                          : dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });

                        return (
                          <div
                            className="chart-column"
                            key={`${item.datetime}-${index}`}
                            title={`${item.value} µg/m³ · Observed at ${hour}h IST (${formatDateTime(item.datetime)}) · Hourly observation snapshot`}
                          >
                            <div
                              className="chart-bar"
                              style={{
                                height: `${Math.max((val / maxValue) * 100, 3)}%`,
                                backgroundColor: '#00897b'
                              }}
                            />
                            <span>{hour}h</span>
                          </div>
                        );
                      })}
                    </div>

                    <p className="muted chart-note">
                      Each bar represents an authentic hourly observation in Indian Standard Time (IST).
                      Hover over any bar to view the exact mass concentration and timestamp.
                      Official CPCB NAAQS categories evaluate rolling 24-hour averages, not isolated hourly bars.
                    </p>
                  </>
                )}
              </div>
            </section>

            {/* Map and Insights Grid */}
            <section className="section lower-grid">
              <div className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Location Overview</h2>
                    <p>{currentLocation?.name || 'Monitoring Site'} · Data Source: OpenAQ</p>
                  </div>
                </div>

                <div className="map-container">
                  {currentLocation?.latitude && currentLocation?.longitude ? (
                    <MapContainer
                      key={`${currentLocation.latitude}-${currentLocation.longitude}`}
                      center={[currentLocation.latitude, currentLocation.longitude]}
                      zoom={11}
                      style={{ height: '320px', width: '100%', borderRadius: '12px' }}
                    >
                      <TileLayer
                        attribution='&copy; OpenStreetMap contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />

                      {/* Station Marker */}
                      <Marker
                        position={[currentLocation.latitude, currentLocation.longitude]}
                        icon={selectedLocationId === 8118 ? pinDelhi : pinAmbala}
                      >
                        <Popup>
                          <strong>{currentLocation.name}</strong><br />
                          PM2.5: {pm25 ? `${pm25.value} µg/m³` : 'Reading unavailable'}<br />
                          Locality: {currentLocation.locality || (selectedLocationId === 8118 ? 'Chanakyapuri, New Delhi' : 'Ambala, Haryana')}<br />
                          OpenAQ Provider: {currentLocation.provider || (selectedLocationId === 8118 ? 'AirNow' : 'CPCB')}<br />
                          Station Network: {selectedLocationId === 8118 ? 'U.S. Diplomatic Post Monitor via AirNow' : 'Haryana State Pollution Control Board (HSPCB)'}
                        </Popup>
                      </Marker>

                      {/* If Ambala is selected, also show the 25km circle */}
                      {selectedLocationId === 6964 && (
                        <Circle
                          center={[30.378, 76.776]}
                          radius={25000}
                          pathOptions={{ color: '#00897b', fillColor: '#80cbc4', fillOpacity: 0.15 }}
                        />
                      )}
                    </MapContainer>
                  ) : (
                    <p>Loading monitoring location...</p>
                  )}
                </div>
              </div>

              {/* Insights and Quick Nav */}
              <div className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Air Quality Navigation</h2>
                    <p>Detailed modules & insights</p>
                  </div>
                </div>

                <div className="insight" onClick={() => setActiveNav('compare')} style={{ cursor: 'pointer' }}>
                  <span>⇄</span>
                  <div>
                    <h3>Compare New Delhi vs Ambala</h3>
                    <p>Side-by-side comparison with genuine station within 25 km of Ambala (Patti Mehar).</p>
                  </div>
                </div>

                <div className="insight" onClick={() => setActiveNav('trends')} style={{ cursor: 'pointer' }}>
                  <span>◷</span>
                  <div>
                    <h3>Historical Trends & Statistics</h3>
                    <p>Track 24h & 7-day variation, minimums, maximums, and period averages.</p>
                  </div>
                </div>

                <div className="insight" onClick={() => setActiveNav('health')} style={{ cursor: 'pointer' }}>
                  <span>♡</span>
                  <div>
                    <h3>Health Guidance & NAAQS Standards</h3>
                    <p>Evidence-based recommendations for general and sensitive populations.</p>
                  </div>
                </div>

                <div className="insight" onClick={() => setActiveNav('forecast')} style={{ cursor: 'pointer' }}>
                  <span>☼</span>
                  <div>
                    <h3>Forecast Transparency Disclosure</h3>
                    <p>Honest forecast-unavailable status and atmospheric modeling explanation.</p>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {activeNav === 'map' && (
          <MapView
            activeStationId={selectedLocationId}
            onSelectStation={(id) => {
              setSelectedLocationId(id);
            }}
            delhiData={delhiAir}
            ambalaData={ambalaAir}
          />
        )}

        {activeNav === 'trends' && (
          <TrendsView
            activeStationId={selectedLocationId}
            onStationChange={(id) => setSelectedLocationId(id)}
          />
        )}

        {activeNav === 'compare' && (
          <CompareView nowTimestamp={now} />
        )}

        {activeNav === 'health' && (
          <HealthView
            currentPm25={pm25 ? pm25.value : null}
            stats24h={stats24h}
            stationName={currentStationName}
          />
        )}

                {activeNav === 'forecast' && (
          <ForecastView
            latitude={currentLocation?.latitude}
            longitude={currentLocation?.longitude}
            stationName={currentStationName}
          />
        )}

        {/* Global Footer */}
        <footer>
          <div className="footer-content">
            <p><strong>BreatheWise</strong> · Verified observations. Model-based forecasts. Clear scientific insights.</p>
             <p>Observational data powered by OpenAQ v3. Air quality forecasts powered by Open-Meteo.</p>
            <p className="footer-disclaimer">
              Scientific Notice: PM2.5 concentration in µg/m³ measures particulate mass density.
              It is distinct from the composite Air Quality Index (AQI), which is calculated via official non-linear breakpoint equations.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
