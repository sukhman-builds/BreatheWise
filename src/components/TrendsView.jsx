import { useEffect, useState, useMemo } from 'react';
import { fetchHistory } from '../api/client';
import { formatDateTime, getTimeAgo } from '../utils/pm25Standards';
import { getStationById } from '../config/stations';

export default function TrendsView({ activeStationId, nowTimestamp }) {
  const currentStation = useMemo(() => {
    return getStationById(activeStationId || 8118);
  }, [activeStationId]);

  const sensorId = currentStation?.pm25SensorId;

  const [history, setHistory] = useState([]);
  const [fetchedAt, setFetchedAt] = useState('');
  const [fetchTimestamp, setFetchTimestamp] = useState(null);
  const [isStaleData, setIsStaleData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('24h'); // '24h' or '7d'
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadData() {
      if (!sensorId) {
        if (isMounted) {
          setHistory([]);
          setError('No PM2.5 sensor is reported for this monitoring site.');
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError('');
      try {
        const data = await fetchHistory(sensorId, {
          force: refreshCount > 0,
          signal: controller.signal
        });
        if (!isMounted) return;
        setHistory(data.measurements || []);
        setFetchedAt(data.fetchedAt || '');
        setIsStaleData(Boolean(data.isStale));
        setFetchTimestamp(Date.now());
        setError('');
      } catch (err) {
        if (err.name === 'AbortError') return;
        if (isMounted) setError(err.message || 'Error fetching historical data.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [sensorId, refreshCount]);

  // Filter valid measurements
  const validData = useMemo(() => {
    return history.filter(
      item => item.value !== null && Number.isFinite(Number(item.value))
    );
  }, [history]);

  // 24h view uses the most recent 24 data points; 7d uses up to available readings
  const displayedData = useMemo(() => {
    if (viewMode === '24h') {
      return validData.slice(0, 24).reverse();
    }
    return [...validData].reverse();
  }, [validData, viewMode]);

  // Statistics calculation
  const values = useMemo(() => displayedData.map(d => Number(d.value)), [displayedData]);
  const currentVal = validData[0]?.value ?? null;
  const latestTime = validData[0]?.datetime ?? null;
  const effectiveNow = nowTimestamp || fetchTimestamp;
  const timeAgoText = (latestTime && effectiveNow) ? getTimeAgo(latestTime, effectiveNow) : null;
  const latestAgeHours = latestTime && effectiveNow
    ? (effectiveNow - new Date(latestTime).getTime()) / 3600000
    : null;
  const isLatestStale = isStaleData || (latestAgeHours !== null && latestAgeHours > 3);
  const minVal = values.length ? Math.min(...values) : 0;
  const maxVal = values.length ? Math.max(...values) : 0;
  const avgVal = values.length
    ? (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(1)
    : '—';

  // Dynamic y-axis scale headroom
  const chartMax = Math.max(Math.ceil((maxVal * 1.15) / 10) * 10, 80);

  // CPCB 24-hr NAAQS standard threshold (60 µg/m³)
  const cpcbThreshold = 60;
  const cpcbThresholdPercent = (cpcbThreshold / chartMax) * 100;

  return (
    <div className="trends-view">
      {/* 1. Header: Page Title + Time-Range Tabs */}
      <div className="trends-header">
        <div>
          <h2>Historical PM2.5 Trends</h2>
          <p className="trends-subtitle">
            Time-series particulate observations from ambient ground-monitoring sensors
          </p>
        </div>

        {/* Time-Range Tabs */}
        <div className="view-mode-toggle" role="tablist" aria-label="Historical time range">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === '24h'}
            className={`toggle-btn ${viewMode === '24h' ? 'active' : ''}`}
            onClick={() => setViewMode('24h')}
          >
            Last 24 Readings
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === '7d'}
            className={`toggle-btn ${viewMode === '7d' ? 'active' : ''}`}
            onClick={() => setViewMode('7d')}
          >
            7-Day History {validData.length > 0 ? `(${validData.length} pts)` : ''}
          </button>
        </div>
      </div>

      {/* 2. Compact Selected-Station Information Card (automatically follows global selector) */}
      <div className="trends-station-card">
        <div className="trends-station-primary">
          <span
            className="trends-city-badge"
            style={{ backgroundColor: currentStation.pinColor || '#1b4937' }}
          >
            {currentStation.cityName}
          </span>
          <div className="trends-station-name-wrap">
            <h3>{currentStation.name}</h3>
            <p className="trends-station-locality">
              {currentStation.locality} · Provider: <strong>{currentStation.provider}</strong> · Network: <strong>{currentStation.network}</strong>
            </p>
          </div>
        </div>

        <div className="trends-station-meta-tags">
          <span className="trends-meta-pill">
            <span className="meta-pill-label">SENSOR ID</span>
            <strong>{sensorId ? `#${sensorId}` : 'Unassigned'}</strong>
          </span>
          <span className="trends-meta-pill">
            <span className="meta-pill-label">COORDINATES</span>
            <strong>{currentStation.latitude.toFixed(3)}°N, {currentStation.longitude.toFixed(3)}°E</strong>
          </span>
          <span className="trends-meta-pill status-pill-verified">
            <span className="live-dot" style={{ backgroundColor: '#2e7d32' }}></span>
            <span>OpenAQ Verified</span>
          </span>
        </div>
      </div>

      {loading ? (
        <div className="loading-card">
          <div className="spinner"></div>
          <p>Retrieving authentic historical measurements for sensor #{sensorId}...</p>
        </div>
      ) : error ? (
        <div className="error-card">
          <span className="error-icon">⚠</span>
          <div>
            <h3>Historical Data Unavailable</h3>
            <p>{error}</p>
            {sensorId && (
              <button
                type="button"
                className="btn-retry"
                onClick={() => setRefreshCount(c => c + 1)}
              >
                Retry Request
              </button>
            )}
          </div>
        </div>
      ) : displayedData.length === 0 ? (
        <div className="empty-card">
          <p>No historical measurements available for this sensor over the selected timeframe.</p>
        </div>
      ) : (
        <>
          {/* 3. Four Compact Metric Cards with Neutral Labels */}
          <div className="trends-metrics-grid">
            {/* Latest Reading */}
            <div className="trends-metric-card">
              <div className="metric-card-top">
                <span className="metric-card-label">{isLatestStale ? 'LAST OBSERVED · STALE' : 'LATEST READING'}</span>
                <span className="metric-unit-tag">µg/m³</span>
              </div>
              <div className="metric-card-value">
                {currentVal !== null ? currentVal : '—'}
              </div>
              <div className="metric-card-sub">
                {isLatestStale && <span className="stale-reading-label">Not current</span>}
                {timeAgoText ? `Observed ${timeAgoText}` : latestTime ? `Recorded at ${formatDateTime(latestTime)}` : 'Most recent observation'}
              </div>
            </div>

            {/* Period Average */}
            <div className="trends-metric-card">
              <div className="metric-card-top">
                <span className="metric-card-label">PERIOD AVERAGE</span>
                <span className="metric-unit-tag">µg/m³</span>
              </div>
              <div className="metric-card-value">
                {avgVal}
              </div>
              <div className="metric-card-sub">
                Mean across {displayedData.length} observations
              </div>
            </div>

            {/* Minimum */}
            <div className="trends-metric-card">
              <div className="metric-card-top">
                <span className="metric-card-label">MINIMUM</span>
                <span className="metric-unit-tag">µg/m³</span>
              </div>
              <div className="metric-card-value text-min">
                {minVal.toFixed(1)}
              </div>
              <div className="metric-card-sub">
                Lowest recorded reading in period
              </div>
            </div>

            {/* Maximum */}
            <div className="trends-metric-card">
              <div className="metric-card-top">
                <span className="metric-card-label">MAXIMUM</span>
                <span className="metric-unit-tag">µg/m³</span>
              </div>
              <div className="metric-card-value text-max">
                {maxVal.toFixed(1)}
              </div>
              <div className="metric-card-sub">
                Highest recorded reading in period
              </div>
            </div>
          </div>

          {/* 4. Enhanced Historical Chart Panel */}
          <div className="panel chart-panel">
            <div className="chart-header">
              <div>
                <h4>PM2.5 Mass Concentration Timeline</h4>
                <p className="chart-subtitle">
                  {viewMode === '24h' ? 'Chronological hourly observations' : 'Multi-day historical trend'} · Physical mass density (µg/m³)
                </p>
              </div>

              {/* Dynamic hover or latest observation chip */}
              <div className="chart-current-chip">
                {hoveredPoint ? (
                  <span className="chip-active-val">
                    <strong>{hoveredPoint.value} µg/m³</strong> at {formatDateTime(hoveredPoint.datetime)} (IST)
                  </span>
                ) : (
                  <span className="chip-idle-text">
                    Hover over bars to inspect hourly readings
                  </span>
                )}
              </div>
            </div>

            {/* Chart Area with Y-Axis and Reference Guideline */}
            <div className="chart-plot-wrapper">
              {/* Y-Axis scale labels */}
              <div className="chart-y-axis" aria-hidden="true">
                <span>{chartMax}</span>
                <span>{Math.round(chartMax * 0.75)}</span>
                <span>{Math.round(chartMax * 0.5)}</span>
                <span>{Math.round(chartMax * 0.25)}</span>
                <span>0</span>
              </div>

              {/* Chart Plot Area */}
              <div className="chart-plot-area">
                {/* Horizontal reference lines */}
                <div className="grid-line line-100" style={{ bottom: '100%' }}></div>
                <div className="grid-line line-75" style={{ bottom: '75%' }}></div>
                <div className="grid-line line-50" style={{ bottom: '50%' }}></div>
                <div className="grid-line line-25" style={{ bottom: '25%' }}></div>
                <div className="grid-line line-0" style={{ bottom: '0%' }}></div>

                {/* Subtle CPCB 24-hr Standard Line (60 µg/m³) */}
                {cpcbThresholdPercent > 0 && cpcbThresholdPercent < 100 && (
                  <div
                    className="cpcb-reference-line"
                    style={{ bottom: `${cpcbThresholdPercent}%` }}
                    title="Subtle reference: CPCB 24-hour standard threshold (60 µg/m³)"
                  >
                    <span className="cpcb-line-tag">CPCB 24h Standard: 60 µg/m³</span>
                  </div>
                )}

                {/* Bars flex track */}
                <div className="chart-bars-track">
                  {displayedData.map((item, index) => {
                    const val = Number(item.value);
                    const heightPercent = Math.min(Math.max((val / chartMax) * 100, 2), 100);

                    // Color based on Indian CPCB NAAQS brackets
                    let barColor = '#4caf50'; // Good (0-30)
                    if (val > 250) barColor = '#b71c1c'; // Severe (>250)
                    else if (val > 120) barColor = '#c2185b'; // Very Poor (121-250)
                    else if (val > 90) barColor = '#e65100'; // Poor (91-120)
                    else if (val > 60) barColor = '#f57f17'; // Moderate (61-90)
                    else if (val > 30) barColor = '#8bc34a'; // Satisfactory (31-60)

                    const dateObj = new Date(item.datetime);
                    const hour = isNaN(dateObj.getTime())
                      ? `${index}h`
                      : dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });

                    const dateLabel = isNaN(dateObj.getTime())
                      ? ''
                      : dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });

                    // Label frequency calculation to prevent crowding
                    const totalBars = displayedData.length;
                    const showLabel = viewMode === '24h'
                      ? (totalBars <= 12 || index % 2 === 0)
                      : (index % Math.ceil(totalBars / 8) === 0);

                    const isHovered = hoveredPoint === item;

                    return (
                      <div
                        key={`${item.datetime}-${index}`}
                        className={`chart-bar-slot ${isHovered ? 'hovered' : ''}`}
                        onMouseEnter={() => setHoveredPoint(item)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      >
                        <div className="bar-track-outer">
                          <div
                            className="bar-track-fill"
                            style={{
                              height: `${heightPercent}%`,
                              backgroundColor: barColor
                            }}
                          />
                        </div>

                        {showLabel && (
                          <span className="chart-x-label">
                            {viewMode === '24h' ? `${hour}h` : dateLabel}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Chart Legend & Context Footer */}
            <div className="chart-legend-row">
              <span className="legend-head">CPCB Categories:</span>
              <div className="legend-chip">
                <span className="legend-color-dot" style={{ backgroundColor: '#4caf50' }}></span>
                <span>Good (≤30)</span>
              </div>
              <div className="legend-chip">
                <span className="legend-color-dot" style={{ backgroundColor: '#8bc34a' }}></span>
                <span>Satisfactory (31–60)</span>
              </div>
              <div className="legend-chip">
                <span className="legend-color-dot" style={{ backgroundColor: '#f57f17' }}></span>
                <span>Moderate (61–90)</span>
              </div>
              <div className="legend-chip">
                <span className="legend-color-dot" style={{ backgroundColor: '#e65100' }}></span>
                <span>Poor (91–120)</span>
              </div>
              <div className="legend-chip">
                <span className="legend-color-dot" style={{ backgroundColor: '#c2185b' }}></span>
                <span>Very Poor (121–250)</span>
              </div>
              <div className="legend-chip">
                <span className="legend-color-dot" style={{ backgroundColor: '#b71c1c' }}></span>
                <span>Severe (&gt;250)</span>
              </div>
            </div>

            <div className="chart-footer-meta">
              <span>Sensor: <strong>#{sensorId}</strong> ({currentStation.provider})</span>
              <span>Unit: <strong>µg/m³</strong> (Physical mass density)</span>
              <span>Timezone: <strong>Asia/Kolkata (IST)</strong></span>
              {fetchedAt && <span>Retrieved: {formatDateTime(fetchedAt)}</span>}
            </div>
          </div>

          {/* 5. Scientific Accuracy: Compact Collapsible Information Section */}
          <details className="scientific-collapsible">
            <summary className="scientific-summary">
              <span className="summary-icon">⚖</span>
              <span className="summary-title">Scientific Interpretation & Regulatory Context</span>
              <span className="summary-badge">Physical Concentration vs. AQI</span>
              <span className="summary-chevron" aria-hidden="true">▾</span>
            </summary>
            <div className="scientific-content">
              <div className="scientific-grid">
                <div className="scientific-item">
                  <strong>Physical Concentration (µg/m³):</strong>
                  <p>
                    Values displayed represent physical mass density of airborne particulate matter smaller than 2.5 micrometers.
                    Mass concentration is distinct from the multi-pollutant composite Air Quality Index (AQI), which relies on non-linear piecewise linear conversion formulas across multiple criteria gases and particulates.
                  </p>
                </div>
                <div className="scientific-item">
                  <strong>Regulatory 24-Hour Averaging:</strong>
                  <p>
                    Official Central Pollution Control Board (CPCB) NAAQS standards evaluate statutory compliance against a <strong>rolling 24-hour mean concentration</strong> (60 µg/m³).
                    Individual hourly bars inform real-time situational awareness (e.g. morning peak inversion or afternoon ventilation), but single readings do not represent official compliance status.
                  </p>
                </div>
              </div>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
