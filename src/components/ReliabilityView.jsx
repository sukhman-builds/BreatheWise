import { useState, useEffect, useMemo } from 'react';
import { assessStationReliability } from '../utils/dataReliability.js';
import { checkBackendHealth } from '../api/client.js';

export default function ReliabilityView({
  currentStation,
  currentAir,
  locationMeta,
  currentHistory = [],
  nowTimestamp,
  activeError = null
}) {
  const [apiHealth, setApiHealth] = useState(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [pingLatency, setPingLatency] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Ping backend health
  useEffect(() => {
    let isCancelled = false;
    const start = performance.now();

    checkBackendHealth({ timeoutMs: 10000 })
      .then(health => {
        if (isCancelled) return;
        const latency = Math.round(performance.now() - start);
        setApiHealth(health);
        setPingLatency(latency);
        setCheckingHealth(false);
      })
      .catch(() => {
        if (isCancelled) return;
        setCheckingHealth(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [refreshKey]);

  const report = useMemo(() => {
    return assessStationReliability({
      station: currentStation,
      currentAir,
      locationMeta,
      history: currentHistory,
      apiHealth,
      nowTimestamp,
      activeError
    });
  }, [currentStation, currentAir, locationMeta, currentHistory, apiHealth, nowTimestamp, activeError]);

  return (
    <div className="reliability-view">
      {/* 1. Header */}
      <div className="section-heading">
        <div>
          <h2>Data Reliability & Telemetry Monitor</h2>
          <p>
            System-level audit of backend API connectivity, sensor data freshness, and reporting health.
          </p>
        </div>
        <button
          type="button"
          className="btn-refresh"
          onClick={() => {
            setCheckingHealth(true);
            setRefreshKey(k => k + 1);
          }}
          disabled={checkingHealth}
        >
          {checkingHealth ? 'Pinging Backend...' : '↻ Re-check Connectivity'}
        </button>
      </div>

      {/* 2. Top-Level Telemetry Cards */}
      <div className="telemetry-grid">
        {/* Backend Connectivity */}
        <div className="telemetry-card">
          <div className="telemetry-card-top">
            <span className="telemetry-label">BACKEND API PROXY</span>
            <span
              className="status-dot"
              style={{
                backgroundColor: report.backend.isOnline ? '#2e7d32' : '#c62828'
              }}
            />
          </div>
          <div className="telemetry-value">
            {report.backend.statusLabel}
          </div>
          <p className="telemetry-sub">
            {report.backend.description}
            {pingLatency !== null && report.backend.isOnline && (
              <span className="latency-tag"> (Latency: {pingLatency}ms)</span>
            )}
          </p>
        </div>

        {/* Data Freshness Classification */}
        <div className="telemetry-card">
          <div className="telemetry-card-top">
            <span className="telemetry-label">DATA FRESHNESS STATUS</span>
            <span
              className="status-dot"
              style={{
                backgroundColor: report.freshness.isLive
                  ? '#2e7d32'
                  : report.freshness.isCached
                    ? '#0288d1'
                    : report.freshness.isStale
                      ? '#b26a00'
                      : '#c62828'
              }}
            />
          </div>
          <div className="telemetry-value">
            {report.freshness.label}
          </div>
          <p className="telemetry-sub">
            {report.freshness.description}
          </p>
        </div>

        {/* Physical Sensor Observation Timestamp */}
        <div className="telemetry-card">
          <div className="telemetry-card-top">
            <span className="telemetry-label">GROUND SENSOR OBSERVATION</span>
            <span className="telemetry-clock-icon">⏱</span>
          </div>
          <div className="telemetry-timestamp-val">
            {report.timestamps.measurementTime}
          </div>
          <p className="telemetry-sub">
            Elapsed Age: <strong>{report.timestamps.measurementAge}</strong>
          </p>
        </div>

        {/* Proxy Fetch Timestamp */}
        <div className="telemetry-card">
          <div className="telemetry-card-top">
            <span className="telemetry-label">PROXY CACHE TIMING</span>
            <span className="telemetry-clock-icon">⚡</span>
          </div>
          <div className="telemetry-timestamp-val">
            {report.timestamps.fetchTime}
          </div>
          <p className="telemetry-sub">
            Proxy Retrieval: <strong>{report.timestamps.fetchAge}</strong> (5-min TTL)
          </p>
        </div>
      </div>

      {/* 3. Station Sensor Breakdown Panel */}
      <div className="panel sensor-audit-panel">
        <div className="section-heading">
          <div>
            <h3>Active Station Sensor Audit: {currentStation.name}</h3>
            <p>
              Hardware sensor reporting breakdown for location ID #{currentStation.id} ({currentStation.provider})
            </p>
          </div>
          <div className="sensor-tally-pill">
            <span>{report.sensors.activeReporting} of {report.sensors.totalConfigured} Parameters Reporting</span>
          </div>
        </div>

        <div className="table-responsive">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Pollutant Parameter</th>
                <th>Sensor ID</th>
                <th>Reported Value</th>
                <th>Reporting Status</th>
              </tr>
            </thead>
            <tbody>
              {report.sensors.readingsSummary.length > 0 ? (
                report.sensors.readingsSummary.map((sensor, idx) => (
                  <tr key={`${sensor.sensorId}-${idx}`}>
                    <td><strong>{sensor.pollutant}</strong></td>
                    <td>#{sensor.sensorId || 'N/A'}</td>
                    <td>
                      {sensor.value !== null ? (
                        <span><strong>{sensor.value}</strong> {sensor.unit}</span>
                      ) : (
                        <span className="text-muted">No value</span>
                      )}
                    </td>
                    <td>
                      <span className="status-tag active-tag">✓ Active Ground Observation</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
                    No sensor readings currently reported for this station.
                  </td>
                </tr>
              )}
              {report.sensors.missingParameters.map(param => (
                <tr key={param}>
                  <td><strong>{param.toUpperCase()}</strong></td>
                  <td>Unassigned</td>
                  <td><span className="text-muted">—</span></td>
                  <td>
                    <span className="status-tag missing-tag">Offline / Not Reported by Provider</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Telemetry Explanations & Transparency */}
      <div className="panel telemetry-info-panel">
        <h4>Telemetry Protocol & Transparency Disclosure</h4>
        <div className="disclaimer-grid">
          <div className="disclaimer-block">
            <strong>Truth in Telemetry:</strong>
            <p>
              BreatheWise never displays synthetic success indicators or mock values. If OpenAQ or local sensors fail to broadcast observations, the state is accurately surfaced as Stale, Cached, or Unavailable with real timestamps.
            </p>
          </div>
          <div className="disclaimer-block">
            <strong>Resilient Tiering:</strong>
            <p>
              To maintain high uptime against intermittent upstream glitches, successful observations are safely cached with strict TTLs (5m for air quality, 15m for history). Stale readings are always visibly labeled and never confused with live observations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
