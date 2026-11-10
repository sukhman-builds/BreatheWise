import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import {
  calculate24HourStats,
  getSnapshotAdvisory,
  formatDateTime,
  getTimeAgo
} from '../utils/pm25Standards';
import {
  SUPPORTED_STATIONS,
  getStationById
} from '../config/stations';

export default function CompareView({ nowTimestamp, activeStationId }) {
  const [stationAId, setStationAId] = useState(() => activeStationId || 8118);
  const [stationBId, setStationBId] = useState(() => {
    return activeStationId === 6964 ? 8118 : 6964;
  });

  const [dataA, setDataA] = useState(null);
  const [dataB, setDataB] = useState(null);
  const [historyA, setHistoryA] = useState([]);
  const [historyB, setHistoryB] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  const stationA = getStationById(stationAId);
  const stationB = getStationById(stationBId);

  useEffect(() => {
    let isMounted = true;

    async function loadComparison() {
      setLoading(true);
      setError('');

      try {
        const fetchList = [
          fetch(`${API_BASE_URL}/api/air-quality/${stationAId}`),
          fetch(`${API_BASE_URL}/api/air-quality/${stationBId}`)
        ];

        if (stationA?.pm25SensorId) {
          fetchList.push(fetch(`${API_BASE_URL}/api/history/${stationA.pm25SensorId}`));
        } else {
          fetchList.push(Promise.resolve(null));
        }

        if (stationB?.pm25SensorId) {
          fetchList.push(fetch(`${API_BASE_URL}/api/history/${stationB.pm25SensorId}`));
        } else {
          fetchList.push(Promise.resolve(null));
        }

        const [resAqA, resAqB, resHistA, resHistB] = await Promise.all(fetchList);

        if (!resAqA.ok && !resAqB.ok) {
          throw new Error('Failed to retrieve comparative air quality data from OpenAQ proxy.');
        }

        const [aqA, aqB, histA, histB] = await Promise.all([
          resAqA.ok ? resAqA.json() : null,
          resAqB.ok ? resAqB.json() : null,
          resHistA && resHistA.ok ? resHistA.json() : { measurements: [] },
          resHistB && resHistB.ok ? resHistB.json() : { measurements: [] }
        ]);

        if (!isMounted) return;
        setDataA(aqA);
        setDataB(aqB);
        setHistoryA(histA?.measurements || []);
        setHistoryB(histB?.measurements || []);
      } catch (err) {
        if (isMounted) setError(err.message || 'Error loading comparison data.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadComparison();
    return () => { isMounted = false; };
  }, [stationAId, stationBId, stationA?.pm25SensorId, stationB?.pm25SensorId, refreshCount]);

  const handleSwap = () => {
    const tempA = stationAId;
    const tempB = stationBId;
    setStationAId(tempB);
    setStationBId(tempA);
  };

  const pm25A = dataA?.readings?.find(r => r.pollutant === 'pm25');
  const pm25B = dataB?.readings?.find(r => r.pollutant === 'pm25');

  // Compute authentic rolling 24-hour statistics for both stations
  const stats24hA = calculate24HourStats(historyA, nowTimestamp);
  const stats24hB = calculate24HourStats(historyB, nowTimestamp);

  // Compute non-regulatory hourly snapshot advisories
  const snapshotA = getSnapshotAdvisory(pm25A?.value);
  const snapshotB = getSnapshotAdvisory(pm25B?.value);

  const timeA = pm25A?.datetime?.local || pm25A?.datetime?.utc;
  const timeB = pm25B?.datetime?.local || pm25B?.datetime?.utc;

  // Pollutants to compare in table
  const pollutantKeys = [
    { key: 'pm25', name: 'PM2.5', unit: 'µg/m³', desc: 'Fine respirable particles (<2.5 µm)' },
    { key: 'pm10', name: 'PM10', unit: 'µg/m³', desc: 'Inhalable coarse particles (<10 µm)' },
    { key: 'no2', name: 'NO₂', unit: 'µg/m³ / ppb', desc: 'Nitrogen dioxide from combustion' },
    { key: 'so2', name: 'SO₂', unit: 'µg/m³ / ppb', desc: 'Sulphur dioxide from power plants/fuels' },
    { key: 'co', name: 'CO', unit: 'µg/m³ / ppb', desc: 'Carbon monoxide from incomplete combustion' },
    { key: 'o3', name: 'O₃', unit: 'µg/m³ / ppb', desc: 'Ground-level photochemical ozone' }
  ];

  // Compare 24-hour averages if both available; otherwise snapshots
  const diff24h = (stats24hA.average !== null && stats24hB.average !== null)
    ? (Number(stats24hA.average) - Number(stats24hB.average)).toFixed(1)
    : null;

  const diffSnapshot = (pm25A?.value != null && pm25B?.value != null)
    ? (Number(pm25A.value) - Number(pm25B.value)).toFixed(1)
    : null;

  return (
    <div className="compare-view">
      <div className="section-heading">
        <div>
          <h2>Multi-City Air Quality Comparison</h2>
          <p>
            Side-by-side comparative analysis of verified OpenAQ monitoring stations
          </p>
        </div>
        <button
          type="button"
          className="btn-refresh"
          onClick={() => setRefreshCount(c => c + 1)}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : '↻ Refresh Data'}
        </button>
      </div>

      {/* Station Selector Control Bar */}
      <div className="compare-selectors-bar">
        <div className="compare-select-block">
          <label htmlFor="stationASelect" className="selector-label">LOCATION A:</label>
          <select
            id="stationASelect"
            className="station-dropdown"
            value={stationAId}
            onChange={(e) => setStationAId(Number(e.target.value))}
          >
            {SUPPORTED_STATIONS.map(s => (
              <option key={s.id} value={s.id} disabled={s.id === stationBId}>
                {s.cityName} · {s.shortName || s.name} (ID: {s.id})
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="btn-swap-locations"
          onClick={handleSwap}
          title="Swap Locations"
        >
          ⇄ Swap
        </button>

        <div className="compare-select-block">
          <label htmlFor="stationBSelect" className="selector-label">LOCATION B:</label>
          <select
            id="stationBSelect"
            className="station-dropdown"
            value={stationBId}
            onChange={(e) => setStationBId(Number(e.target.value))}
          >
            {SUPPORTED_STATIONS.map(s => (
              <option key={s.id} value={s.id} disabled={s.id === stationAId}>
                {s.cityName} · {s.shortName || s.name} (ID: {s.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-card">
          <div className="spinner"></div>
          <p>Fetching verified station observations and historical timelines from OpenAQ...</p>
        </div>
      ) : error ? (
        <div className="error-card">
          <span className="error-icon">⚠</span>
          <div>
            <h3>Comparison Unavailable</h3>
            <p>{error}</p>
            <button className="btn-retry" onClick={() => setRefreshCount(c => c + 1)}>
              Retry Request
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Difference Summary Highlight */}
          <div className="compare-callout">
            <span className="callout-badge">DIFFERENCE ANALYSIS</span>
            {diff24h !== null ? (
              <>
                <h3>
                  {Number(diff24h) > 0 ? (
                    <>{stationB.cityName} rolling 24-hour PM2.5 average is <strong>{Math.abs(diff24h)} µg/m³ lower</strong> than {stationA.cityName}</>
                  ) : Number(diff24h) < 0 ? (
                    <>{stationA.cityName} rolling 24-hour PM2.5 average is <strong>{Math.abs(diff24h)} µg/m³ lower</strong> than {stationB.cityName}</>
                  ) : (
                    <>Both stations report identical rolling 24-hour PM2.5 averages</>
                  )}
                </h3>
                <p className="callout-note">
                  Based on rolling 24-hour averages calculated from ground sensor observations.
                  {diffSnapshot !== null && (
                    <span> Latest single hourly reading difference: {Math.abs(diffSnapshot)} µg/m³ ({Number(diffSnapshot) > 0 ? `${stationB.cityName} lower` : `${stationA.cityName} lower`}).</span>
                  )}
                </p>
              </>
            ) : diffSnapshot !== null ? (
              <>
                <h3>
                  {Number(diffSnapshot) > 0 ? (
                    <>{stationB.cityName} latest hourly PM2.5 snapshot is <strong>{Math.abs(diffSnapshot)} µg/m³ lower</strong> than {stationA.cityName}</>
                  ) : Number(diffSnapshot) < 0 ? (
                    <>{stationA.cityName} latest hourly PM2.5 snapshot is <strong>{Math.abs(diffSnapshot)} µg/m³ lower</strong> than {stationB.cityName}</>
                  ) : (
                    <>Both stations report identical instantaneous PM2.5 readings</>
                  )}
                </h3>
                <p className="callout-note">
                  * Note: Instantaneous hourly snapshots. Rolling 24-hour average comparison is pending sufficient historical observations.
                </p>
              </>
            ) : (
              <p className="callout-note">Comparative observations pending sensor availability.</p>
            )}
          </div>

          {/* Cards Grid */}
          <div className="compare-grid">
            {/* Station A Card */}
            <div className="compare-card">
              <div className="compare-header">
                <div>
                  <span className="station-type-tag" style={{ borderLeft: `3px solid ${stationA.pinColor || '#1b5e20'}` }}>
                    {stationA.cityName.toUpperCase()}
                  </span>
                  <h3>{stationA.name}</h3>
                  <p className="station-meta">Location ID: {stationA.id} · Provider: {stationA.provider} · Network: {stationA.network}</p>
                </div>
                <span className="status-pill active">LIVE MONITOR</span>
              </div>

              {/* Primary 24-Hour Rolling Average */}
              <div className="compare-main-metric">
                <span className="metric-label">ROLLING 24-HOUR PM2.5 AVERAGE</span>
                <div
                  className="metric-number"
                  style={{
                    color: (stats24hA.hasData && stats24hA.coverageQuality !== 'insufficient')
                      ? stats24hA.category.color
                      : '#666'
                  }}
                >
                  {stats24hA.hasData && stats24hA.average !== null ? stats24hA.average : '—'}
                  <span className="metric-unit">µg/m³</span>
                </div>

                <div
                  className="category-pill"
                  style={{
                    backgroundColor: (stats24hA.hasData && stats24hA.coverageQuality !== 'insufficient')
                      ? stats24hA.category.bgColor
                      : '#f5f5f5',
                    color: (stats24hA.hasData && stats24hA.coverageQuality !== 'insufficient')
                      ? stats24hA.category.color
                      : '#666',
                    borderColor: (stats24hA.hasData && stats24hA.coverageQuality !== 'insufficient')
                      ? stats24hA.category.borderColor
                      : '#ddd'
                  }}
                >
                  {stats24hA.hasData && stats24hA.coverageQuality !== 'insufficient'
                    ? `${stats24hA.category.label} — ${stats24hA.statusLabel}`
                    : stats24hA.statusLabel}
                </div>

                <p className="coverage-detail-text" style={{ fontSize: '11px', color: '#6d8274', marginTop: '8px' }}>
                  ℹ {stats24hA.statusDescription}
                </p>
              </div>

              {/* Segregated Latest Hourly Snapshot */}
              <div className="timestamp-box" style={{ background: '#f8faf7', border: '1px solid #e4ece1', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
                <span className="metric-label" style={{ textAlign: 'left', marginBottom: '4px' }}>LATEST HOURLY READING (SNAPSHOT)</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e3a2b' }}>
                    {pm25A ? `${pm25A.value}` : '—'} <span style={{ fontSize: '12px', fontWeight: 600, color: '#7a8e80' }}>µg/m³</span>
                  </div>
                  <div
                    className="category-pill"
                    style={{
                      backgroundColor: snapshotA.bgColor,
                      color: snapshotA.color,
                      borderColor: snapshotA.borderColor,
                      fontSize: '10px',
                      padding: '2px 8px'
                    }}
                  >
                    {snapshotA.label}
                  </div>
                </div>
                <div className="timestamp-row">
                  <span className="timestamp-label">Observed at:</span>
                  <span className="timestamp-value">
                    {formatDateTime(timeA)}
                    {timeA && (
                      <span className="time-ago-tag">({getTimeAgo(timeA, nowTimestamp)})</span>
                    )}
                  </span>
                </div>
                <div className="timestamp-row">
                  <span className="timestamp-label">Fetched from OpenAQ:</span>
                  <span className="timestamp-value">{formatDateTime(dataA?.fetchedAt)}</span>
                </div>
                <small style={{ fontSize: '10px', color: '#7a8e80', fontStyle: 'italic', marginTop: '4px', display: 'block' }}>
                  * {snapshotA.disclaimer}
                </small>
              </div>

              <div className="station-coords-box">
                <span>📍 Coordinates: {stationA.latitude.toFixed(4)}°N, {stationA.longitude.toFixed(4)}°E</span>
                <span>Locality: {stationA.locality}</span>
              </div>
            </div>

            {/* Station B Card */}
            <div className="compare-card">
              <div className="compare-header">
                <div>
                  <span className="station-type-tag" style={{ borderLeft: `3px solid ${stationB.pinColor || '#00695c'}` }}>
                    {stationB.cityName.toUpperCase()}
                  </span>
                  <h3>{stationB.name}</h3>
                  <p className="station-meta">Location ID: {stationB.id} · Provider: {stationB.provider} · Network: {stationB.network}</p>
                </div>
                <span className="status-pill active">LIVE MONITOR</span>
              </div>

              {/* Primary 24-Hour Rolling Average */}
              <div className="compare-main-metric">
                <span className="metric-label">ROLLING 24-HOUR PM2.5 AVERAGE</span>
                <div
                  className="metric-number"
                  style={{
                    color: (stats24hB.hasData && stats24hB.coverageQuality !== 'insufficient')
                      ? stats24hB.category.color
                      : '#666'
                  }}
                >
                  {stats24hB.hasData && stats24hB.average !== null ? stats24hB.average : '—'}
                  <span className="metric-unit">µg/m³</span>
                </div>

                <div
                  className="category-pill"
                  style={{
                    backgroundColor: (stats24hB.hasData && stats24hB.coverageQuality !== 'insufficient')
                      ? stats24hB.category.bgColor
                      : '#f5f5f5',
                    color: (stats24hB.hasData && stats24hB.coverageQuality !== 'insufficient')
                      ? stats24hB.category.color
                      : '#666',
                    borderColor: (stats24hB.hasData && stats24hB.coverageQuality !== 'insufficient')
                      ? stats24hB.category.borderColor
                      : '#ddd'
                  }}
                >
                  {stats24hB.hasData && stats24hB.coverageQuality !== 'insufficient'
                    ? `${stats24hB.category.label} — ${stats24hB.statusLabel}`
                    : stats24hB.statusLabel}
                </div>

                <p className="coverage-detail-text" style={{ fontSize: '11px', color: '#6d8274', marginTop: '8px' }}>
                  ℹ {stats24hB.statusDescription}
                </p>
              </div>

              {/* Segregated Latest Hourly Snapshot */}
              <div className="timestamp-box" style={{ background: '#f8faf7', border: '1px solid #e4ece1', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
                <span className="metric-label" style={{ textAlign: 'left', marginBottom: '4px' }}>LATEST HOURLY READING (SNAPSHOT)</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e3a2b' }}>
                    {pm25B ? `${pm25B.value}` : '—'} <span style={{ fontSize: '12px', fontWeight: 600, color: '#7a8e80' }}>µg/m³</span>
                  </div>
                  <div
                    className="category-pill"
                    style={{
                      backgroundColor: snapshotB.bgColor,
                      color: snapshotB.color,
                      borderColor: snapshotB.borderColor,
                      fontSize: '10px',
                      padding: '2px 8px'
                    }}
                  >
                    {snapshotB.label}
                  </div>
                </div>
                <div className="timestamp-row">
                  <span className="timestamp-label">Observed at:</span>
                  <span className="timestamp-value">
                    {formatDateTime(timeB)}
                    {timeB && (
                      <span className="time-ago-tag">({getTimeAgo(timeB, nowTimestamp)})</span>
                    )}
                  </span>
                </div>
                <div className="timestamp-row">
                  <span className="timestamp-label">Fetched from OpenAQ:</span>
                  <span className="timestamp-value">{formatDateTime(dataB?.fetchedAt)}</span>
                </div>
                <small style={{ fontSize: '10px', color: '#7a8e80', fontStyle: 'italic', marginTop: '4px', display: 'block' }}>
                  * {snapshotB.disclaimer}
                </small>
              </div>

              <div className="station-coords-box">
                <span>📍 Coordinates: {stationB.latitude.toFixed(4)}°N, {stationB.longitude.toFixed(4)}°E</span>
                <span>Locality: {stationB.locality}</span>
              </div>
            </div>
          </div>

          {/* Multi-pollutant Comparison Table */}
          <div className="panel compare-table-panel">
            <div className="section-heading">
              <div>
                <h2>Multi-Pollutant Side-by-Side Breakdown</h2>
                <p>Available pollutant measurements reported by respective OpenAQ station sensors</p>
              </div>
            </div>

            <div className="table-responsive">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Pollutant</th>
                    <th>{stationA.cityName} ({stationA.shortName || stationA.id})</th>
                    <th>{stationB.cityName} ({stationB.shortName || stationB.id})</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {pollutantKeys.map(p => {
                    const readA = dataA?.readings?.find(r => r.pollutant === p.key);
                    const readB = dataB?.readings?.find(r => r.pollutant === p.key);

                    return (
                      <tr key={p.key}>
                        <td className="pollutant-cell">
                          <strong>{p.name}</strong>
                          <span className="cell-unit">{p.unit}</span>
                        </td>
                        <td className="data-cell">
                          {readA ? (
                            <span className="reading-val">{readA.value} <small>{readA.unit}</small></span>
                          ) : (
                            <span className="reading-na">Sensor not reported</span>
                          )}
                        </td>
                        <td className="data-cell">
                          {readB ? (
                            <span className="reading-val">{readB.value} <small>{readB.unit}</small></span>
                          ) : (
                            <span className="reading-na">Sensor not reported</span>
                          )}
                        </td>
                        <td className="desc-cell">{p.desc}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Scientific Disclaimer Card */}
          <div className="disclaimer-banner">
            <span className="disclaimer-icon">ℹ</span>
            <div>
              <strong>Scientific & Measurement Accuracy Notice:</strong>
              <p>
                Rolling 24-hour PM2.5 averages evaluate diurnal particulate exposure across available valid historical ground readings.
                Single hourly snapshot observations reflect immediate ambient conditions at reporting time.
                Physical particulate mass concentration (µg/m³) is distinct from the composite Air Quality Index (AQI), which is calculated via non-linear piecewise linear equations across multiple criteria pollutants.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
