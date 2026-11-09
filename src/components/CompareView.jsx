import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import {
  calculate24HourStats,
  getSnapshotAdvisory,
  formatDateTime,
  getTimeAgo
} from '../utils/pm25Standards';

export default function CompareView({ nowTimestamp }) {
  const [delhiData, setDelhiData] = useState(null);
  const [ambalaData, setAmbalaData] = useState(null);
  const [delhiLoc, setDelhiLoc] = useState(null);
  const [ambalaLoc, setAmbalaLoc] = useState(null);
  const [delhiHistory, setDelhiHistory] = useState([]);
  const [ambalaHistory, setAmbalaHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchComparisonData = async () => {
    setLoading(true);
    setError('');
    try {
      const [delhiAqRes, ambalaAqRes, delhiLocRes, ambalaLocRes, delhiHistRes, ambalaHistRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/air-quality/8118`),
        fetch(`${API_BASE_URL}/api/air-quality/6964`),
        fetch(`${API_BASE_URL}/api/location/8118`),
        fetch(`${API_BASE_URL}/api/location/6964`),
        fetch(`${API_BASE_URL}/api/history/23534`),
        fetch(`${API_BASE_URL}/api/history/14258997`)
      ]);

      if (!delhiAqRes.ok || !ambalaAqRes.ok) {
        throw new Error('Failed to retrieve comparative air quality data from OpenAQ proxy.');
      }

      const [delhiAq, ambalaAq, delhiL, ambalaL, delhiH, ambalaH] = await Promise.all([
        delhiAqRes.json(),
        ambalaAqRes.json(),
        delhiLocRes.json(),
        ambalaLocRes.json(),
        delhiHistRes.ok ? delhiHistRes.json() : { measurements: [] },
        ambalaHistRes.ok ? ambalaHistRes.json() : { measurements: [] }
      ]);

      setDelhiData(delhiAq);
      setAmbalaData(ambalaAq);
      setDelhiLoc(delhiL);
      setAmbalaLoc(ambalaL);
      setDelhiHistory(delhiH.measurements || []);
      setAmbalaHistory(ambalaH.measurements || []);
    } catch (err) {
      setError(err.message || 'Error loading comparison data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadInitial() {
      try {
        const [delhiAqRes, ambalaAqRes, delhiLocRes, ambalaLocRes, delhiHistRes, ambalaHistRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/air-quality/8118`),
          fetch(`${API_BASE_URL}/api/air-quality/6964`),
          fetch(`${API_BASE_URL}/api/location/8118`),
          fetch(`${API_BASE_URL}/api/location/6964`),
          fetch(`${API_BASE_URL}/api/history/23534`),
          fetch(`${API_BASE_URL}/api/history/14258997`)
        ]);

        if (!delhiAqRes.ok || !ambalaAqRes.ok) {
          throw new Error('Failed to retrieve comparative air quality data from OpenAQ proxy.');
        }

        const [delhiAq, ambalaAq, delhiL, ambalaL, delhiH, ambalaH] = await Promise.all([
          delhiAqRes.json(),
          ambalaAqRes.json(),
          delhiLocRes.json(),
          ambalaLocRes.json(),
          delhiHistRes.ok ? delhiHistRes.json() : { measurements: [] },
          ambalaHistRes.ok ? ambalaHistRes.json() : { measurements: [] }
        ]);

        if (!isMounted) return;
        setDelhiData(delhiAq);
        setAmbalaData(ambalaAq);
        setDelhiLoc(delhiL);
        setAmbalaLoc(ambalaL);
        setDelhiHistory(delhiH.measurements || []);
        setAmbalaHistory(ambalaH.measurements || []);
        setError('');
      } catch (err) {
        if (isMounted) setError(err.message || 'Error loading comparison data.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitial();
    return () => { isMounted = false; };
  }, []);

  const delhiPm25 = delhiData?.readings?.find(r => r.pollutant === 'pm25');
  const ambalaPm25 = ambalaData?.readings?.find(r => r.pollutant === 'pm25');

  // Compute authentic rolling 24-hour statistics for both stations
  const delhiStats24h = calculate24HourStats(delhiHistory, nowTimestamp);
  const ambalaStats24h = calculate24HourStats(ambalaHistory, nowTimestamp);

  // Compute non-regulatory hourly snapshot advisories
  const delhiSnapshot = getSnapshotAdvisory(delhiPm25?.value);
  const ambalaSnapshot = getSnapshotAdvisory(ambalaPm25?.value);

  const delhiTime = delhiPm25?.datetime?.local || delhiPm25?.datetime?.utc;
  const ambalaTime = ambalaPm25?.datetime?.local || ambalaPm25?.datetime?.utc;

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
  const diff24h = (delhiStats24h.average !== null && ambalaStats24h.average !== null)
    ? (Number(delhiStats24h.average) - Number(ambalaStats24h.average)).toFixed(1)
    : null;

  const diffSnapshot = (delhiPm25?.value && ambalaPm25?.value)
    ? (Number(delhiPm25.value) - Number(ambalaPm25.value)).toFixed(1)
    : null;

  return (
    <div className="compare-view">
      <div className="section-heading">
        <div>
          <h2>Station Comparison: New Delhi vs Ambala</h2>
          <p>Comparing Capital NCR monitoring against the nearest genuine station within 25 km of Ambala (Patti Mehar)</p>
        </div>
        <button className="btn-refresh" onClick={fetchComparisonData} disabled={loading}>
          {loading ? 'Refreshing...' : '↻ Refresh Data'}
        </button>
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
            <button className="btn-retry" onClick={fetchComparisonData}>Retry Request</button>
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
                    <>Ambala rolling 24-hour PM2.5 average is <strong>{Math.abs(diff24h)} µg/m³ lower</strong> than New Delhi</>
                  ) : Number(diff24h) < 0 ? (
                    <>New Delhi rolling 24-hour PM2.5 average is <strong>{Math.abs(diff24h)} µg/m³ lower</strong> than Ambala</>
                  ) : (
                    <>Both stations report identical rolling 24-hour PM2.5 averages</>
                  )}
                </h3>
                <p className="callout-note">
                  Based on rolling 24-hour averages calculated from ground sensor observations.
                  {diffSnapshot !== null && (
                    <span> Latest single hourly reading difference: {Math.abs(diffSnapshot)} µg/m³ ({Number(diffSnapshot) > 0 ? 'Ambala lower' : 'New Delhi lower'}).</span>
                  )}
                </p>
              </>
            ) : diffSnapshot !== null ? (
              <>
                <h3>
                  {Number(diffSnapshot) > 0 ? (
                    <>Ambala latest hourly PM2.5 snapshot is <strong>{Math.abs(diffSnapshot)} µg/m³ lower</strong> than New Delhi</>
                  ) : Number(diffSnapshot) < 0 ? (
                    <>New Delhi latest hourly PM2.5 snapshot is <strong>{Math.abs(diffSnapshot)} µg/m³ lower</strong> than Ambala</>
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
            {/* New Delhi Card */}
            <div className="compare-card">
              <div className="compare-header">
                <div>
                  <span className="station-type-tag">NATIONAL CAPITAL (NCR)</span>
                  <h3>{delhiLoc?.name || 'New Delhi'}</h3>
                  <p className="station-meta">Location ID: 8118 · Provider: AirNow · Network: U.S. Diplomatic Post</p>
                </div>
                <span className="status-pill active">LIVE MONITOR</span>
              </div>

              {/* Primary 24-Hour Rolling Average */}
              <div className="compare-main-metric">
                <span className="metric-label">ROLLING 24-HOUR PM2.5 AVERAGE</span>
                <div
                  className="metric-number"
                  style={{
                    color: (delhiStats24h.hasData && delhiStats24h.coverageQuality !== 'insufficient')
                      ? delhiStats24h.category.color
                      : '#666'
                  }}
                >
                  {delhiStats24h.hasData && delhiStats24h.average !== null ? delhiStats24h.average : '—'}
                  <span className="metric-unit">µg/m³</span>
                </div>

                <div
                  className="category-pill"
                  style={{
                    backgroundColor: (delhiStats24h.hasData && delhiStats24h.coverageQuality !== 'insufficient')
                      ? delhiStats24h.category.bgColor
                      : '#f5f5f5',
                    color: (delhiStats24h.hasData && delhiStats24h.coverageQuality !== 'insufficient')
                      ? delhiStats24h.category.color
                      : '#666',
                    borderColor: (delhiStats24h.hasData && delhiStats24h.coverageQuality !== 'insufficient')
                      ? delhiStats24h.category.borderColor
                      : '#ddd'
                  }}
                >
                  {delhiStats24h.hasData && delhiStats24h.coverageQuality !== 'insufficient'
                    ? `${delhiStats24h.category.label} — ${delhiStats24h.statusLabel}`
                    : delhiStats24h.statusLabel}
                </div>

                <p className="coverage-detail-text" style={{ fontSize: '11px', color: '#6d8274', marginTop: '8px' }}>
                  ℹ {delhiStats24h.statusDescription}
                </p>
              </div>

              {/* Segregated Latest Hourly Snapshot */}
              <div className="timestamp-box" style={{ background: '#f8faf7', border: '1px solid #e4ece1', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
                <span className="metric-label" style={{ textAlign: 'left', marginBottom: '4px' }}>LATEST HOURLY READING (SNAPSHOT)</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e3a2b' }}>
                    {delhiPm25 ? `${delhiPm25.value}` : '—'} <span style={{ fontSize: '12px', fontWeight: 600, color: '#7a8e80' }}>µg/m³</span>
                  </div>
                  <div
                    className="category-pill"
                    style={{
                      backgroundColor: delhiSnapshot.bgColor,
                      color: delhiSnapshot.color,
                      borderColor: delhiSnapshot.borderColor,
                      fontSize: '10px',
                      padding: '2px 8px'
                    }}
                  >
                    {delhiSnapshot.label}
                  </div>
                </div>
                <div className="timestamp-row">
                  <span className="timestamp-label">Observed at:</span>
                  <span className="timestamp-value">
                    {formatDateTime(delhiTime)}
                    {delhiTime && (
                      <span className="time-ago-tag">({getTimeAgo(delhiTime, nowTimestamp)})</span>
                    )}
                  </span>
                </div>
                <div className="timestamp-row">
                  <span className="timestamp-label">Fetched from OpenAQ:</span>
                  <span className="timestamp-value">{formatDateTime(delhiData?.fetchedAt)}</span>
                </div>
                <small style={{ fontSize: '10px', color: '#7a8e80', fontStyle: 'italic', marginTop: '4px', display: 'block' }}>
                  * {delhiSnapshot.disclaimer}
                </small>
              </div>

              <div className="station-coords-box">
                <span>📍 Coordinates: {delhiLoc?.latitude?.toFixed(4)}°N, {delhiLoc?.longitude?.toFixed(4)}°E</span>
                <span>Country: {delhiLoc?.country || 'India'}</span>
              </div>
            </div>

            {/* Ambala Card */}
            <div className="compare-card">
              <div className="compare-header">
                <div>
                  <span className="station-type-tag">HARYANA PLAINS</span>
                  <h3>{ambalaLoc?.name || 'Patti Mehar, Ambala - HSPCB'}</h3>
                  <p className="station-meta">Location ID: 6964 · Provider: CPCB · Agency: Haryana State Pollution Control Board</p>
                </div>
                <span className="status-pill active">LIVE MONITOR</span>
              </div>

              {/* Primary 24-Hour Rolling Average */}
              <div className="compare-main-metric">
                <span className="metric-label">ROLLING 24-HOUR PM2.5 AVERAGE</span>
                <div
                  className="metric-number"
                  style={{
                    color: (ambalaStats24h.hasData && ambalaStats24h.coverageQuality !== 'insufficient')
                      ? ambalaStats24h.category.color
                      : '#666'
                  }}
                >
                  {ambalaStats24h.hasData && ambalaStats24h.average !== null ? ambalaStats24h.average : '—'}
                  <span className="metric-unit">µg/m³</span>
                </div>

                <div
                  className="category-pill"
                  style={{
                    backgroundColor: (ambalaStats24h.hasData && ambalaStats24h.coverageQuality !== 'insufficient')
                      ? ambalaStats24h.category.bgColor
                      : '#f5f5f5',
                    color: (ambalaStats24h.hasData && ambalaStats24h.coverageQuality !== 'insufficient')
                      ? ambalaStats24h.category.color
                      : '#666',
                    borderColor: (ambalaStats24h.hasData && ambalaStats24h.coverageQuality !== 'insufficient')
                      ? ambalaStats24h.category.borderColor
                      : '#ddd'
                  }}
                >
                  {ambalaStats24h.hasData && ambalaStats24h.coverageQuality !== 'insufficient'
                    ? `${ambalaStats24h.category.label} — ${ambalaStats24h.statusLabel}`
                    : ambalaStats24h.statusLabel}
                </div>

                <p className="coverage-detail-text" style={{ fontSize: '11px', color: '#6d8274', marginTop: '8px' }}>
                  ℹ {ambalaStats24h.statusDescription}
                </p>
              </div>

              {/* Segregated Latest Hourly Snapshot */}
              <div className="timestamp-box" style={{ background: '#f8faf7', border: '1px solid #e4ece1', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
                <span className="metric-label" style={{ textAlign: 'left', marginBottom: '4px' }}>LATEST HOURLY READING (SNAPSHOT)</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e3a2b' }}>
                    {ambalaPm25 ? `${ambalaPm25.value}` : '—'} <span style={{ fontSize: '12px', fontWeight: 600, color: '#7a8e80' }}>µg/m³</span>
                  </div>
                  <div
                    className="category-pill"
                    style={{
                      backgroundColor: ambalaSnapshot.bgColor,
                      color: ambalaSnapshot.color,
                      borderColor: ambalaSnapshot.borderColor,
                      fontSize: '10px',
                      padding: '2px 8px'
                    }}
                  >
                    {ambalaSnapshot.label}
                  </div>
                </div>
                <div className="timestamp-row">
                  <span className="timestamp-label">Observed at:</span>
                  <span className="timestamp-value">
                    {formatDateTime(ambalaTime)}
                    {ambalaTime && (
                      <span className="time-ago-tag">({getTimeAgo(ambalaTime, nowTimestamp)})</span>
                    )}
                  </span>
                </div>
                <div className="timestamp-row">
                  <span className="timestamp-label">Fetched from OpenAQ:</span>
                  <span className="timestamp-value">{formatDateTime(ambalaData?.fetchedAt)}</span>
                </div>
                <small style={{ fontSize: '10px', color: '#7a8e80', fontStyle: 'italic', marginTop: '4px', display: 'block' }}>
                  * {ambalaSnapshot.disclaimer}
                </small>
              </div>

              <div className="station-coords-box">
                <span>📍 Coordinates: {ambalaLoc?.latitude?.toFixed(4)}°N, {ambalaLoc?.longitude?.toFixed(4)}°E</span>
                <span>Distance: ~240m from Ambala reference center</span>
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
                    <th>New Delhi (8118)</th>
                    <th>Ambala (6964)</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {pollutantKeys.map(p => {
                    const dRead = delhiData?.readings?.find(r => r.pollutant === p.key);
                    const aRead = ambalaData?.readings?.find(r => r.pollutant === p.key);

                    return (
                      <tr key={p.key}>
                        <td className="pollutant-cell">
                          <strong>{p.name}</strong>
                          <span className="cell-unit">{p.unit}</span>
                        </td>
                        <td className="data-cell">
                          {dRead ? (
                            <span className="reading-val">{dRead.value} <small>{dRead.unit}</small></span>
                          ) : (
                            <span className="reading-na">Sensor not reported</span>
                          )}
                        </td>
                        <td className="data-cell">
                          {aRead ? (
                            <span className="reading-val">{aRead.value} <small>{aRead.unit}</small></span>
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
