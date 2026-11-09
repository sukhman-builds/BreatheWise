import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import { formatDateTime, PM25_LEVELS } from '../utils/pm25Standards';

export default function TrendsView({ activeStationId, onStationChange }) {
  const [selectedStation, setSelectedStation] = useState(activeStationId || 8118);
  const [history, setHistory] = useState([]);
  const [fetchedAt, setFetchedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('24h'); // '24h' or '7d'
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Station definitions with verified PM2.5 sensor IDs
  const stations = {
    8118: {
      name: 'New Delhi (US Diplomatic Post)',
      sensorId: 23534,
      locality: 'New Delhi, NCR'
    },
    6964: {
      name: 'Patti Mehar, Ambala - HSPCB',
      sensorId: 14258997,
      locality: 'Ambala, Haryana'
    }
  };

  const currentStation = stations[selectedStation] || stations[8118];

  const fetchHistoryData = async (sensorId) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/history/${sensorId}`);
      if (!res.ok) {
        throw new Error('Unable to retrieve historical trend data from OpenAQ proxy.');
      }
      const data = await res.json();
      setHistory(data.measurements || []);
      setFetchedAt(data.fetchedAt || '');
    } catch (err) {
      setError(err.message || 'Error fetching historical data.');
    } finally {
      setLoading(false);
    }
  };

  const sensorId = currentStation.sensorId;

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/history/${sensorId}`);
        if (!res.ok) {
          throw new Error('Unable to retrieve historical trend data from OpenAQ proxy.');
        }
        const data = await res.json();
        if (!isMounted) return;
        setHistory(data.measurements || []);
        setFetchedAt(data.fetchedAt || '');
        setError('');
      } catch (err) {
        if (isMounted) setError(err.message || 'Error fetching historical data.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [sensorId]);

  const handleStationSelect = (id) => {
    setSelectedStation(id);
    setLoading(true);
    if (onStationChange) onStationChange(id);
  };

  // Filter valid measurements
  const validData = history.filter(
    item => item.value !== null && Number.isFinite(Number(item.value))
  );

  // 24h view uses the most recent 24 data points; 7d uses up to available readings
  const displayedData = viewMode === '24h'
    ? validData.slice(0, 24).reverse()
    : [...validData].reverse();

  // Statistics calculation
  const values = displayedData.map(d => Number(d.value));
  const currentVal = validData[0]?.value ?? null;
  const minVal = values.length ? Math.min(...values) : 0;
  const maxVal = values.length ? Math.max(...values) : 0;
  const avgVal = values.length
    ? (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(1)
    : 0;

  const chartMax = Math.max(maxVal * 1.1, 50);

  return (
    <div className="trends-view">
      <div className="section-heading">
        <div>
          <h2>Historical PM2.5 Pollution Trends</h2>
          <p>Verified observational measurements recorded by OpenAQ ambient air monitors</p>
        </div>
        <div className="station-selector-group">
          <button
            className={`station-btn ${selectedStation === 8118 ? 'active' : ''}`}
            onClick={() => handleStationSelect(8118)}
          >
            New Delhi (8118)
          </button>
          <button
            className={`station-btn ${selectedStation === 6964 ? 'active' : ''}`}
            onClick={() => handleStationSelect(6964)}
          >
            Ambala (6964)
          </button>
        </div>
      </div>

      {/* Header and Controls */}
      <div className="trends-controls-bar">
        <div className="station-info-header">
          <span className="station-badge">ACTIVE STATION</span>
          <h3>{currentStation.name}</h3>
          <p className="muted">PM2.5 Sensor ID: {currentStation.sensorId} · {currentStation.locality}</p>
        </div>

        <div className="view-mode-toggle">
          <button
            className={`toggle-btn ${viewMode === '24h' ? 'active' : ''}`}
            onClick={() => setViewMode('24h')}
          >
            Latest 24 Readings
          </button>
          <button
            className={`toggle-btn ${viewMode === '7d' ? 'active' : ''}`}
            onClick={() => setViewMode('7d')}
          >
            7-Day History ({validData.length} pts)
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-card">
          <div className="spinner"></div>
          <p>Loading verified historical data for sensor {currentStation.sensorId}...</p>
        </div>
      ) : error ? (
        <div className="error-card">
          <span className="error-icon">⚠</span>
          <div>
            <h3>Historical Data Unavailable</h3>
            <p>{error}</p>
            <button className="btn-retry" onClick={() => fetchHistoryData(currentStation.sensorId)}>Retry Request</button>
          </div>
        </div>
      ) : displayedData.length === 0 ? (
        <div className="empty-card">
          <p>No historical measurements available for this sensor over the selected timeframe.</p>
        </div>
      ) : (
        <>
          {/* Summary Statistics Cards */}
          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-label">CURRENT READING</span>
              <div className="stat-val">
                {currentVal !== null ? `${currentVal}` : '—'} <small>µg/m³</small>
              </div>
              <span className="stat-sub">Latest recorded point</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">PERIOD AVERAGE</span>
              <div className="stat-val">{avgVal} <small>µg/m³</small></div>
              <span className="stat-sub">Across {displayedData.length} measurements</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">MINIMUM</span>
              <div className="stat-val stat-good">{minVal.toFixed(1)} <small>µg/m³</small></div>
              <span className="stat-sub">Cleanest interval</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">MAXIMUM</span>
              <div className="stat-val stat-high">{maxVal.toFixed(1)} <small>µg/m³</small></div>
              <span className="stat-sub">Peak pollution event</span>
            </div>
          </div>

          {/* Chart Panel */}
          <div className="panel chart-panel">
            <div className="chart-header">
              <div>
                <h4>PM2.5 Mass Concentration Over Time</h4>
                <p className="chart-subtitle">
                  {viewMode === '24h' ? 'Showing latest 24 observations' : `Showing all ${displayedData.length} observations from the last 7 days`}
                </p>
              </div>

              {fetchedAt && (
                <div className="fetch-indicator">
                  <span>OpenAQ fetch time: {formatDateTime(fetchedAt)}</span>
                </div>
              )}
            </div>

            {/* Interactive Tooltip Card if hovering */}
            {hoveredPoint && (
              <div className="chart-tooltip-display">
                <span className="tooltip-dot" style={{ backgroundColor: '#00897b' }}></span>
                <strong>{hoveredPoint.value} µg/m³</strong>
                <span className="tooltip-cat">(Hourly observation snapshot · Not a 24-hour regulatory category)</span>
                <span className="tooltip-time">Measured: {formatDateTime(hoveredPoint.datetime)}</span>
              </div>
            )}

            {/* Bar Chart Container */}
            <div className="interactive-chart-container">
              <div className="chart-y-axis">
                <span>{Math.round(chartMax)}</span>
                <span>{Math.round(chartMax * 0.75)}</span>
                <span>{Math.round(chartMax * 0.5)}</span>
                <span>{Math.round(chartMax * 0.25)}</span>
                <span>0</span>
              </div>

              <div className="chart-bars-wrap">
                {displayedData.map((item, index) => {
                  const val = Number(item.value);
                  const heightPercent = Math.max((val / chartMax) * 100, 2);
                  const dateObj = new Date(item.datetime);
                  const hourLabel = isNaN(dateObj.getTime())
                    ? String(index)
                    : dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });

                  return (
                    <div
                      className="interactive-bar-col"
                      key={`${item.datetime}-${index}`}
                      onMouseEnter={() => setHoveredPoint(item)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      <div className="bar-track">
                        <div
                          className="colored-bar"
                          style={{
                            height: `${heightPercent}%`,
                            backgroundColor: '#00897b'
                          }}
                        />
                      </div>
                      <span className="bar-axis-label">{hourLabel}h</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Threshold Legend */}
            <div className="chart-legend">
              <span className="legend-title">CPCB NAAQS 24-hr PM2.5 Reference Bands (Evaluated against 24-hour averages, not isolated hourly bars):</span>
              {PM25_LEVELS.map(level => (
                <div className="legend-item" key={level.label}>
                  <span className="legend-color-box" style={{ backgroundColor: level.color }}></span>
                  <span className="legend-name">{level.label}</span>
                  <small className="legend-range">
                    {level.max === Infinity ? '>250' : `≤${level.max}`} µg/m³
                  </small>
                </div>
              ))}
            </div>

            <p className="chart-footer-note">
              * Hover over any bar to inspect timestamp and exact PM2.5 concentration reading. Individual bars represent hourly observations; regulatory CPCB NAAQS benchmarks evaluate rolling 24-hour averages. All times in Indian Standard Time (IST).
            </p>
          </div>
        </>
      )}
    </div>
  );
}
