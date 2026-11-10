import { useMemo } from 'react';
import { findCleanAirWindow } from '../utils/cleanAirWindow.js';

export default function CleanAirWindow({
  hourlyForecast = [],
  cityName = '',
  stationName = '',
  loading = false,
  error = '',
  nowTimestamp
}) {
  const windowData = useMemo(() => {
    return findCleanAirWindow(hourlyForecast, { nowTimestamp, windowHours: 3 });
  }, [hourlyForecast, nowTimestamp]);

  if (loading) {
    return (
      <div className="clean-air-card loading-state">
        <div className="clean-air-header">
          <div className="clean-air-badge">
            <span className="clean-air-icon">🍃</span>
            <span>Evaluating Clean Air Window...</span>
          </div>
        </div>
        <p className="clean-air-muted">Analyzing hourly atmospheric forecast simulations for {stationName || cityName || 'this site'}...</p>
      </div>
    );
  }

  if (error || !windowData.available) {
    return (
      <div className="clean-air-card unavailable-state">
        <div className="clean-air-header">
          <div className="clean-air-badge">
            <span className="clean-air-icon">🍃</span>
            <span>Clean Air Window</span>
          </div>
          <span className="forecast-disclaimer-pill">{stationName ? `${stationName} · ` : ''}Forecast Outlook</span>
        </div>
        <p className="clean-air-muted">
          {error || windowData.reason || 'Sufficient upcoming forecast data is not available to compute an outdoor window.'}
        </p>
      </div>
    );
  }

  return (
    <div className="clean-air-card">
      <div className="clean-air-header">
        <div className="clean-air-badge">
          <span className="clean-air-icon">🍃</span>
          <span className="clean-air-title">RECOMMENDED OUTDOOR ACTIVITY WINDOW</span>
        </div>
        <span className="forecast-disclaimer-pill">{stationName ? `${stationName} · ` : ''}Modelled Forecast · Not Guaranteed</span>
      </div>

      <div className="clean-air-body">
        <div className="clean-air-primary">
          <div className="clean-air-time-block">
            <span className="clean-air-day-tag">{windowData.dayLabel}</span>
            <h3 className="clean-air-time-range">{windowData.timeRange}</h3>
          </div>

          <div className="clean-air-metric-box">
            <div className="clean-air-val">
              {windowData.avgPm25} <small>µg/m³</small>
            </div>
            <span
              className="category-pill clean-air-category"
              style={{
                backgroundColor: windowData.category.bgColor,
                color: windowData.category.color,
                borderColor: windowData.category.borderColor
              }}
            >
              {windowData.category.label}
            </span>
          </div>
        </div>

        <div className="clean-air-guidance">
          <p className="clean-air-recommendation">
            <strong>Activity Advice:</strong> {windowData.recommendation}
          </p>
          <p className="clean-air-explanation">
            <strong>Forecast Basis:</strong> {windowData.explanation}
          </p>
        </div>

        <div className="clean-air-footer">
          <span className="clean-air-footer-icon">ℹ</span>
          <p className="clean-air-disclaimer-text">
            {windowData.disclaimer} Always check real-time sensor observations before vigorous exertion.
          </p>
        </div>
      </div>
    </div>
  );
}
