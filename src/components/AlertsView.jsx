import { useMemo } from 'react';
import {
  ALERT_STATUS,
  CPCB_24H_THRESHOLD
} from '../utils/smartAlerts.js';
import { formatDateTime, getTimeAgo } from '../utils/pm25Standards.js';

export default function AlertsView({
  currentStation,
  stats24h,
  latestObservationTime = null,
  nowTimestamp = null,
  alertEvaluation,
  alertHistory = [],
  onDismissAlert,
  onClearHistory,
  onSelectStation
}) {
  const { status, alert, diagnostic } = alertEvaluation;

  const isCurrentAlertDismissed = useMemo(() => {
    if (!alert || !alert.id) return false;
    const match = alertHistory.find(item => item.id === alert.id);
    return match ? Boolean(match.isDismissed) : Boolean(alert.isDismissed);
  }, [alert, alertHistory]);

  const activeAlertsCount = useMemo(() => {
    return alertHistory.filter(item => !item.isDismissed).length;
  }, [alertHistory]);

  return (
    <div className="alerts-view">
      {/* 1. Header & Title */}
      <div className="alerts-header">
        <div>
          <h2>Smart AQI Alerts</h2>
          <p className="alerts-subtitle">
            Automated particulate exposure monitoring based on Indian CPCB NAAQS 24-hour standards (60 µg/m³)
          </p>
        </div>

        {/* Status Pill Badge */}
        <div className="alerts-header-actions">
          <span
            className="alerts-status-pill"
            style={{
              backgroundColor: status === ALERT_STATUS.ACTIVE_ALERT
                ? (alert?.severity?.bgColor || '#ffebee')
                : status === ALERT_STATUS.NORMAL
                  ? '#e8f5e9'
                  : status === ALERT_STATUS.STALE_DATA
                    ? '#fff8e1'
                    : '#f0f4f8',
              color: status === ALERT_STATUS.ACTIVE_ALERT
                ? (alert?.severity?.color || '#b71c1c')
                : status === ALERT_STATUS.NORMAL
                  ? '#2e7d32'
                  : status === ALERT_STATUS.STALE_DATA
                    ? '#b26a00'
                    : '#455a64',
              borderColor: status === ALERT_STATUS.ACTIVE_ALERT
                ? (alert?.severity?.borderColor || '#ef9a9a')
                : status === ALERT_STATUS.NORMAL
                  ? '#a5d6a7'
                  : status === ALERT_STATUS.STALE_DATA
                    ? '#ffe082'
                    : '#cfd8dc'
            }}
          >
            <span
              className="status-dot-indicator"
              style={{ backgroundColor: diagnostic.badgeColor }}
            />
            <span>
              {status === ALERT_STATUS.ACTIVE_ALERT
                ? `${alert?.severity?.levelName.toUpperCase()} ALERT ACTIVE`
                : status === ALERT_STATUS.NORMAL
                  ? 'WITHIN 24H STANDARD'
                  : status === ALERT_STATUS.STALE_DATA
                    ? 'DATA STALE (>3H)'
                    : status === ALERT_STATUS.INSUFFICIENT_DATA
                      ? 'INCOMPLETE 24H DATA'
                      : 'SENSOR UNAVAILABLE'}
            </span>
          </span>
        </div>
      </div>

      {/* 2. Compact Station Information Card */}
      <div className="alerts-station-card">
        <div className="alerts-station-primary">
          <span
            className="station-city-badge"
            style={{ backgroundColor: currentStation.pinColor || '#1b4937' }}
          >
            {currentStation.cityName}
          </span>
          <div className="alerts-station-info">
            <h3>{currentStation.name}</h3>
            <p className="alerts-station-meta">
              {currentStation.locality} · Provider: <strong>{currentStation.provider}</strong> · Network: <strong>{currentStation.network}</strong>
            </p>
          </div>
        </div>

        <div className="alerts-station-tags">
          <span className="alerts-tag">
            <span className="tag-label">SENSOR ID</span>
            <strong>{currentStation.pm25SensorId ? `#${currentStation.pm25SensorId}` : 'Unassigned'}</strong>
          </span>
          <span className="alerts-tag">
            <span className="tag-label">THRESHOLD</span>
            <strong>{CPCB_24H_THRESHOLD} µg/m³</strong>
          </span>
          <span className="alerts-tag">
            <span className="tag-label">COORDS</span>
            <strong>{currentStation.latitude.toFixed(3)}°N, {currentStation.longitude.toFixed(3)}°E</strong>
          </span>
        </div>
      </div>

      {/* 3. Primary Status Display Card */}
      {status === ALERT_STATUS.ACTIVE_ALERT && alert ? (
        <div
          className="panel alert-banner-card active-alert-panel"
          style={{
            borderColor: alert.severity.borderColor,
            background: `linear-gradient(180deg, ${alert.severity.bgColor} 0%, #ffffff 160px)`
          }}
        >
          <div className="alert-card-topbar">
            <div className="alert-badge-group">
              <span
                className="alert-category-badge"
                style={{
                  backgroundColor: alert.severity.color,
                  color: 'white'
                }}
              >
                ⚠ {alert.severity.levelName.toUpperCase()} ADVISORY
              </span>
              <span className="alert-urgency-tag">
                Priority: <strong>{alert.severity.urgency}</strong>
              </span>
              {isCurrentAlertDismissed && (
                <span className="alert-dismissed-tag">
                  ✓ Dismissed by User
                </span>
              )}
            </div>

            {/* Dismiss / Restore Button */}
            <div className="alert-actions">
              {isCurrentAlertDismissed ? (
                <button
                  type="button"
                  className="btn-alert-restore"
                  onClick={() => onDismissAlert && onDismissAlert(alert.id, false)}
                >
                  Undo Dismissal
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-alert-dismiss"
                  onClick={() => onDismissAlert && onDismissAlert(alert.id, true)}
                >
                  ✕ Dismiss Advisory
                </button>
              )}
            </div>
          </div>

          <div className="alert-headline-box">
            <h3 style={{ color: alert.severity.color }}>
              {alert.severity.label}: {alert.measuredValue} µg/m³
            </h3>
            <p className="alert-reason-text">
              {alert.reason}
            </p>
          </div>

          {/* Key Metrics Row */}
          <div className="alert-metrics-grid">
            <div className="alert-metric-item">
              <span className="alert-metric-label">ROLLING 24-HOUR AVERAGE</span>
              <div className="alert-metric-num" style={{ color: alert.severity.color }}>
                {alert.measuredValue} <small>µg/m³</small>
              </div>
              <span className="alert-metric-sub">Physical PM2.5 mass density</span>
            </div>

            <div className="alert-metric-item">
              <span className="alert-metric-label">CPCB 24H STANDARD</span>
              <div className="alert-metric-num text-neutral">
                {alert.threshold} <small>µg/m³</small>
              </div>
              <span className="alert-metric-sub">Indian NAAQS regulatory benchmark</span>
            </div>

            <div className="alert-metric-item">
              <span className="alert-metric-label">EXCESS CONCENTRATION</span>
              <div className="alert-metric-num" style={{ color: alert.severity.color }}>
                +{alert.excessValue} <small>µg/m³</small>
              </div>
              <span className="alert-metric-sub">Amount above standard threshold</span>
            </div>

            <div className="alert-metric-item">
              <span className="alert-metric-label">DATA COVERAGE</span>
              <div className="alert-metric-num text-neutral">
                {alert.distinctHours} <small>/ 24 hrs</small>
              </div>
              <span className="alert-metric-sub">
                {alert.observationsCount} readings across {alert.quadrantsCovered}/4 diurnal quadrants
              </span>
            </div>
          </div>

          {/* Advisory Recommended Actions */}
          <div className="alert-recommendations-panel">
            <h4>{alert.severity.actionHeading} & Recommended Precautions:</h4>
            <ul className="alert-precautions-list">
              {alert.severity.tier === 'severe' ? (
                <>
                  <li><strong>Indoor Confinement:</strong> Remain indoors with windows and doors tightly sealed. Avoid all outdoor exertion.</li>
                  <li><strong>HEPA Filtration:</strong> Run high-efficiency particulate air cleaners continuously in living and sleeping spaces.</li>
                  <li><strong>Respiratory Protection:</strong> If outdoors is unavoidable, use a certified N95, KN95, or FFP2 respirator with an airtight seal.</li>
                  <li><strong>Zero Combustion:</strong> Avoid biomass burning, incense, or frying indoors, which generate extreme micro-spikes.</li>
                </>
              ) : alert.severity.tier === 'very_poor' ? (
                <>
                  <li><strong>Avoid Outdoor Cardio:</strong> Refrain from jogging, cycling, or intense sports outdoors.</li>
                  <li><strong>Vulnerable Groups:</strong> Children, seniors, and individuals with cardiovascular or respiratory disease should remain indoors.</li>
                  <li><strong>N95 Respirators:</strong> Wear certified respirators when commuting or traveling near congested roadways.</li>
                  <li><strong>Indoor Air Filtration:</strong> Keep living areas closed and utilize mechanical HEPA filtration.</li>
                </>
              ) : alert.severity.tier === 'poor' ? (
                <>
                  <li><strong>Limit Strenuous Exertion:</strong> Reduce prolonged or heavy outdoor exertion, especially during morning stagnant hours.</li>
                  <li><strong>Sensitive Groups:</strong> Asthmatics should keep inhalers on hand; seniors should limit time spent in traffic.</li>
                  <li><strong>Ventilation Timing:</strong> Avoid opening windows during early morning inversion or evening traffic peaks.</li>
                </>
              ) : (
                <>
                  <li><strong>General Activity Acceptable:</strong> Normal outdoor activities are generally acceptable for healthy adults.</li>
                  <li><strong>Sensitive Individuals:</strong> Unusually sensitive persons should monitor coughing, throat irritation, or shortness of breath.</li>
                  <li><strong>Exercise Scheduling:</strong> Schedule strenuous activities during afternoon hours when atmospheric ventilation is optimal.</li>
                </>
              )}
            </ul>
          </div>

          {/* Provenance Footer */}
          <div className="alert-provenance-footer">
            <span>Verified Ground Monitor: <strong>Sensor #{alert.sensorId}</strong></span>
            <span>Provider: <strong>{alert.provider}</strong></span>
            <span>Network: <strong>{alert.network}</strong></span>
            <span>
              Latest Reading: {formatDateTime(latestObservationTime)}
              {latestObservationTime && ` (${getTimeAgo(latestObservationTime, nowTimestamp)})`}
            </span>
          </div>
        </div>
      ) : status === ALERT_STATUS.NORMAL ? (
        <div className="panel alert-banner-card normal-status-panel">
          <div className="status-banner-header">
            <span className="normal-status-badge">✓ AIR QUALITY WITHIN STANDARD</span>
            <span className="timestamp-badge">
              Evaluated: {formatDateTime(latestObservationTime)}
            </span>
          </div>
          <div className="alert-headline-box">
            <h3 style={{ color: '#2e7d32' }}>
              Compliant Air Quality: {stats24h.average} µg/m³
            </h3>
            <p className="alert-reason-text">
              The representative rolling 24-hour PM2.5 mean concentration complies with the Indian Central Pollution Control Board (CPCB) NAAQS standard of {CPCB_24H_THRESHOLD} µg/m³. No particulate alert is active.
            </p>
          </div>

          <div className="alert-metrics-grid">
            <div className="alert-metric-item">
              <span className="alert-metric-label">ROLLING 24-HOUR AVERAGE</span>
              <div className="alert-metric-num" style={{ color: '#2e7d32' }}>
                {stats24h.average} <small>µg/m³</small>
              </div>
              <span className="alert-metric-sub">Physical PM2.5 mass density</span>
            </div>

            <div className="alert-metric-item">
              <span className="alert-metric-label">CPCB 24H STANDARD</span>
              <div className="alert-metric-num text-neutral">
                {CPCB_24H_THRESHOLD} <small>µg/m³</small>
              </div>
              <span className="alert-metric-sub">Statutory standard benchmark</span>
            </div>

            <div className="alert-metric-item">
              <span className="alert-metric-label">SAFETY MARGIN</span>
              <div className="alert-metric-num" style={{ color: '#2e7d32' }}>
                {(CPCB_24H_THRESHOLD - stats24h.average).toFixed(1)} <small>µg/m³</small>
              </div>
              <span className="alert-metric-sub">Margin below standard threshold</span>
            </div>

            <div className="alert-metric-item">
              <span className="alert-metric-label">NAAQS BRACKET</span>
              <div className="alert-metric-num" style={{ color: stats24h.category.color }}>
                {stats24h.category.label}
              </div>
              <span className="alert-metric-sub">Clean air objectives met</span>
            </div>
          </div>
        </div>
      ) : status === ALERT_STATUS.STALE_DATA ? (
        <div className="panel alert-banner-card stale-status-panel">
          <div className="status-banner-header">
            <span className="stale-status-badge">⏱ ALERT MONITORING SUSPENDED · STALE DATA</span>
            <span className="timestamp-badge">
              Recorded: {formatDateTime(latestObservationTime)}
            </span>
          </div>
          <div className="alert-headline-box">
            <h3 style={{ color: '#b26a00' }}>
              Sensor Readings Exceed Stale Threshold (&gt; 3 Hours)
            </h3>
            <p className="alert-reason-text">
              The latest measurement from ground sensor #{currentStation.pm25SensorId} was recorded {latestObservationTime ? getTimeAgo(latestObservationTime, nowTimestamp) : 'over 3 hours ago'}.
              Because ambient meteorological and air-quality conditions can shift rapidly, automated alert generation is suspended to avoid false or outdated advisories.
            </p>
          </div>
          <div className="protocol-notice-box">
            <strong>Scientific Protocol Standard:</strong> BreatheWise never issues alerts based on outdated observations. Real-time alert monitoring will resume as soon as fresh sensor packets are published.
          </div>
        </div>
      ) : status === ALERT_STATUS.INSUFFICIENT_DATA ? (
        <div className="panel alert-banner-card insufficient-status-panel">
          <div className="status-banner-header">
            <span className="insufficient-status-badge">ℹ ALERT MONITORING SUSPENDED · INCOMPLETE DATA</span>
            <span className="timestamp-badge">Diurnal Analysis</span>
          </div>
          <div className="alert-headline-box">
            <h3 style={{ color: '#3949ab' }}>
              Representative 24-Hour Diurnal Coverage Required
            </h3>
            <p className="alert-reason-text">
              {stats24h?.statusDescription || 'Insufficient observational history within the rolling 24-hour window to calculate a compliant regulatory standard average.'}
            </p>
          </div>
          <div className="protocol-notice-box">
            <strong>Scientific Integrity Rule:</strong> CPCB NAAQS standards require representative temporal coverage spanning at least 16 distinct hours across at least 3 of 4 diurnal quadrants. BreatheWise strictly adheres to these benchmarks and does not extrapolate or generate speculative alerts from sparse or clustered data.
          </div>
        </div>
      ) : (
        <div className="panel alert-banner-card unavailable-status-panel">
          <div className="status-banner-header">
            <span className="unavailable-status-badge">⚠ MONITORING UNAVAILABLE</span>
            <span className="timestamp-badge">Catalog Status</span>
          </div>
          <div className="alert-headline-box">
            <h3 style={{ color: '#c62828' }}>
              {diagnostic.title}
            </h3>
            <p className="alert-reason-text">
              {diagnostic.message} {diagnostic.details}
            </p>
          </div>
        </div>
      )}

      {/* 4. CPCB NAAQS Alert Thresholds Reference */}
      <div className="panel alert-thresholds-panel">
        <div className="panel-title-bar">
          <div>
            <h3>CPCB 24-Hour NAAQS Particulate Standard & Alert Thresholds</h3>
            <p className="subtitle">Official Central Pollution Control Board (CPCB) statutory benchmarks for physical PM2.5 mass concentration</p>
          </div>
        </div>

        <div className="thresholds-cards-grid">
          <div className="threshold-card compliant-card">
            <div className="threshold-top">
              <span className="threshold-badge good-bg">Good (≤30 µg/m³)</span>
              <span className="threshold-status-text">Clean Air</span>
            </div>
            <h4>0 – 30 µg/m³</h4>
            <p>Meets stringent clean air goals. Little or no health risk. Ideal conditions for outdoor activities.</p>
          </div>

          <div className="threshold-card compliant-card">
            <div className="threshold-top">
              <span className="threshold-badge sat-bg">Satisfactory (31–60 µg/m³)</span>
              <span className="threshold-status-text">Statutory Limit</span>
            </div>
            <h4>31 – 60 µg/m³</h4>
            <p>Complies with Indian NAAQS 24-hour statutory benchmark (60 µg/m³). Normal activities acceptable.</p>
          </div>

          <div className="threshold-card alert-card-mod">
            <div className="threshold-top">
              <span className="threshold-badge mod-bg">Moderate (61–90 µg/m³)</span>
              <span className="threshold-status-text alert-text">Alert Tier 1</span>
            </div>
            <h4>61 – 90 µg/m³</h4>
            <p>Exceeds standard threshold. May cause breathing discomfort to children, seniors, and sensitive groups.</p>
          </div>

          <div className="threshold-card alert-card-poor">
            <div className="threshold-top">
              <span className="threshold-badge poor-bg">Poor (91–120 µg/m³)</span>
              <span className="threshold-status-text alert-text">Alert Tier 2</span>
            </div>
            <h4>91 – 120 µg/m³</h4>
            <p>Significant threshold breach. Breathing discomfort to most people on prolonged exposure. N95 advised.</p>
          </div>

          <div className="threshold-card alert-card-vpoor">
            <div className="threshold-top">
              <span className="threshold-badge vpoor-bg">Very Poor (121–250 µg/m³)</span>
              <span className="threshold-status-text alert-text">Alert Tier 3</span>
            </div>
            <h4>121 – 250 µg/m³</h4>
            <p>Critical threshold breach. Respiratory illness risk on prolonged exposure. Avoid strenuous outdoor activities.</p>
          </div>

          <div className="threshold-card alert-card-severe">
            <div className="threshold-top">
              <span className="threshold-badge severe-bg">Severe (&gt;250 µg/m³)</span>
              <span className="threshold-status-text alert-text">Emergency Alert</span>
            </div>
            <h4>&gt; 250 µg/m³</h4>
            <p>Emergency air pollution event. Affects healthy people and severely impacts individuals with existing diseases.</p>
          </div>
        </div>
      </div>

      {/* 5. Alert History & Audit Log */}
      <div className="panel alert-history-panel">
        <div className="panel-title-bar">
          <div>
            <h3>Alert Event History & Audit Log</h3>
            <p className="subtitle">Chronological record of verified threshold exceedances detected during this session</p>
          </div>
          <div className="history-actions">
            <span className="history-count-badge">
              {activeAlertsCount} ACTIVE / {alertHistory.length} TOTAL
            </span>
            {alertHistory.length > 0 && (
              <button
                type="button"
                className="btn-clear-history"
                onClick={onClearHistory}
              >
                Clear History
              </button>
            )}
          </div>
        </div>

        {alertHistory.length === 0 ? (
          <div className="empty-history-card">
            <span className="empty-icon">🔔</span>
            <h4>No Historical Alerts in This Session</h4>
            <p>
              When an authentic ground sensor reports a representative 24-hour rolling average exceeding the 60 µg/m³ standard, the advisory event is deduplicated and logged here automatically.
            </p>
          </div>
        ) : (
          <div className="history-list">
            {alertHistory.map((item) => (
              <div
                key={item.id}
                className={`history-item-card ${item.isDismissed ? 'dismissed' : 'active'}`}
              >
                <div className="history-item-header">
                  <div className="history-item-station">
                    <span
                      className="category-dot"
                      style={{ backgroundColor: item.severity?.color || '#e65100' }}
                    />
                    <strong>{item.cityName}</strong> · {item.stationName}
                  </div>
                  <div className="history-item-badges">
                    <span
                      className="history-severity-tag"
                      style={{
                        backgroundColor: item.severity?.bgColor || '#fff3e0',
                        color: item.severity?.color || '#e65100',
                        borderColor: item.severity?.borderColor || '#ffcc80'
                      }}
                    >
                      {item.severity?.levelName || 'Advisory'} ({item.measuredValue} µg/m³)
                    </span>
                    {item.isDismissed ? (
                      <span className="badge-dismissed">Dismissed</span>
                    ) : (
                      <span className="badge-active">Active</span>
                    )}
                  </div>
                </div>

                <p className="history-item-reason">{item.reason}</p>

                <div className="history-item-meta">
                  <span>Standard: <strong>{item.threshold || 60} µg/m³</strong> (+{item.excessValue} µg/m³ excess)</span>
                  <span>Sensor: <strong>#{item.sensorId}</strong> ({item.provider})</span>
                  <span>Triggered: <strong>{formatDateTime(item.triggeredAt)}</strong></span>
                  {item.isDismissed && item.dismissedAt && (
                    <span>Dismissed: {formatDateTime(item.dismissedAt)}</span>
                  )}
                </div>

                <div className="history-item-actions">
                  {item.stationId !== currentStation.id && onSelectStation && (
                    <button
                      type="button"
                      className="btn-history-focus"
                      onClick={() => onSelectStation(item.stationId)}
                    >
                      Focus Station →
                    </button>
                  )}
                  {item.isDismissed ? (
                    <button
                      type="button"
                      className="btn-history-toggle"
                      onClick={() => onDismissAlert && onDismissAlert(item.id, false)}
                    >
                      Restore Advisory
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-history-toggle"
                      onClick={() => onDismissAlert && onDismissAlert(item.id, true)}
                    >
                      Dismiss Advisory
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Scientific Regulatory Scope & Non-Emergency Disclaimer */}
      <div className="panel scientific-disclaimer-panel">
        <h4>⚖ Scientific Advisory Scope & Transparency Disclosure</h4>
        <div className="disclaimer-grid">
          <div className="disclaimer-block">
            <strong>Advisory Purpose:</strong>
            <p>
              BreatheWise Smart AQI Alerts are mathematical indicators derived strictly from physical PM2.5 mass concentration measurements published by verified OpenAQ ground sensors. They evaluate whether rolling 24-hour observations exceed the National Ambient Air Quality Standard (NAAQS) threshold of 60 µg/m³ established by the Central Pollution Control Board (CPCB).
            </p>
          </div>
          <div className="disclaimer-block">
            <strong>Non-Emergency & Non-Medical Notice:</strong>
            <p>
              These alerts are automated educational notifications and do not constitute official municipal emergency declarations, CPCB administrative directives, or individualized medical guidance. Persons with pre-existing cardiopulmonary conditions should adhere to care regimens prescribed by their licensed physician.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
