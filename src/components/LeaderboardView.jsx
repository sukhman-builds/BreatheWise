import { useState, useEffect, useMemo, useRef } from 'react';
import { buildCityLeaderboard } from '../utils/leaderboard.js';
import { SUPPORTED_CITIES, getDefaultStationForCity } from '../config/stations.js';
import { fetchAirQuality } from '../api/client.js';

export default function LeaderboardView({
  nowTimestamp,
  onSelectStation,
  onNavigateOverview,
  initialAirQualityMap = {},
  onAirQualityUpdate
}) {
  const [airQualityMap, setAirQualityMap] = useState(() => initialAirQualityMap || {});
  const [loading, setLoading] = useState(() => {
    return SUPPORTED_CITIES.some(c => !initialAirQualityMap?.[getDefaultStationForCity(c).id]);
  });
  const [refreshCount, setRefreshCount] = useState(0);
  const initialLoadDoneRef = useRef(false);
  const onAirQualityUpdateRef = useRef(onAirQualityUpdate);

  // Keep ref synchronized with latest callback without re-triggering the fetch effect
  useEffect(() => {
    onAirQualityUpdateRef.current = onAirQualityUpdate;
  });

  // Fetch air quality for each city's representative station concurrently
  useEffect(() => {
    let isCancelled = false;
    const stations = SUPPORTED_CITIES.map(c => getDefaultStationForCity(c));
    const force = refreshCount > 0;

    // Prevent duplicate initial fetches when state updates; only re-fetch on user refresh
    if (!force && initialLoadDoneRef.current) {
      return;
    }
    initialLoadDoneRef.current = true;

    Promise.allSettled(
      stations.map(station => fetchAirQuality(station.id, { force, timeoutMs: 12000 }))
    ).then(results => {
      if (isCancelled) return;
      const newMap = {};
      results.forEach((res, index) => {
        const stationId = stations[index].id;
        if (res.status === 'fulfilled' && res.value) {
          newMap[stationId] = res.value;
        }
      });

      setAirQualityMap(prev => {
        const merged = { ...prev, ...newMap };
        if (onAirQualityUpdateRef.current) {
          onAirQualityUpdateRef.current(merged);
        }
        return merged;
      });
      setLoading(false);
    }).catch(() => {
      if (!isCancelled) setLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [refreshCount]);

  const leaderboard = useMemo(() => {
    return buildCityLeaderboard(airQualityMap, nowTimestamp);
  }, [airQualityMap, nowTimestamp]);

  const handleCityClick = (stationId) => {
    if (onSelectStation) onSelectStation(stationId);
    if (onNavigateOverview) onNavigateOverview();
  };

  return (
    <div className="leaderboard-view">
      {/* 1. Header */}
      <div className="section-heading">
        <div>
          <h2>Verified City PM2.5 Leaderboard</h2>
          <p>
            Objective ranking of verified Northern Indian cities from lowest to highest physical PM2.5 mass concentration (µg/m³).
            PM2.5 particulate mass concentration is distinct from the multi-pollutant Air Quality Index (AQI).
            Cities with stale or offline sensors are excluded from current live rankings.
          </p>
        </div>
        <button
          type="button"
          className="btn-refresh"
          onClick={() => {
            setLoading(true);
            setRefreshCount(c => c + 1);
          }}
          disabled={loading}
        >
          {loading ? 'Updating Leaderboard...' : '↻ Refresh Rankings'}
        </button>
      </div>

      {/* 2. Highlights Row */}
      <div className="leaderboard-highlights-grid">
        {/* Cleanest City (Current) */}
        <div className="highlight-card cleanest-card">
          <div className="highlight-tag">🌿 LOWEST PM2.5 (CURRENT)</div>
          {leaderboard.cleanestCity ? (
            <div className="highlight-content">
              <h3>{leaderboard.cleanestCity.cityName}</h3>
              <div className="highlight-metric">
                <span className="highlight-num">{leaderboard.cleanestCity.pm25}</span>
                <span className="highlight-unit">µg/m³</span>
              </div>
              <p className="highlight-sub">
                {leaderboard.cleanestCity.category.label} · Station: {leaderboard.cleanestCity.stationName}
              </p>
            </div>
          ) : (
            <p className="highlight-muted">No current verified readings available</p>
          )}
        </div>

        {/* Most Polluted City (Current) */}
        <div className="highlight-card polluted-card">
          <div className="highlight-tag">⚠ HIGHEST PM2.5 (CURRENT)</div>
          {leaderboard.mostPollutedCity ? (
            <div className="highlight-content">
              <h3>{leaderboard.mostPollutedCity.cityName}</h3>
              <div className="highlight-metric">
                <span className="highlight-num">{leaderboard.mostPollutedCity.pm25}</span>
                <span className="highlight-unit">µg/m³</span>
              </div>
              <p className="highlight-sub">
                {leaderboard.mostPollutedCity.category.label} · Station: {leaderboard.mostPollutedCity.stationName}
              </p>
            </div>
          ) : (
            <p className="highlight-muted">No current verified readings available</p>
          )}
        </div>

        {/* Reporting Stats */}
        <div className="highlight-card coverage-card">
          <div className="highlight-tag">📊 CURRENT GROUND COVERAGE</div>
          <div className="highlight-content">
            <h3>{leaderboard.currentReportingCount} of {leaderboard.totalCities} Cities Current</h3>
            <p className="highlight-sub">
              {leaderboard.staleCount > 0 ? `${leaderboard.staleCount} stale (>3h, excluded from ranking); ` : ''}
              {leaderboard.unavailableCount > 0 ? `${leaderboard.unavailableCount} unmonitored / offline.` : 'All cities reporting.'}
            </p>
            <small className="coverage-note">
              5-minute client memory cache active to prevent redundant network calls.
            </small>
          </div>
        </div>
      </div>

      {/* 3. Leaderboard Table / Cards */}
      <div className="panel leaderboard-panel">
        <div className="leaderboard-table-header">
          <span className="col-rank">RANK</span>
          <span className="col-city">CITY & MONITORING SITE</span>
          <span className="col-pm25">PM2.5 CONCENTRATION</span>
          <span className="col-category">NAAQS CATEGORY</span>
          <span className="col-time">OBSERVATION STATUS</span>
          <span className="col-action">ACTION</span>
        </div>

        <div className="leaderboard-rows-wrap">
          {leaderboard.cities.map((item) => (
            <div
              key={item.cityName}
              className={`leaderboard-row ${item.rankingStatus === 'current' ? '' : item.rankingStatus === 'stale' ? 'row-stale' : 'row-unavailable'}`}
              onClick={() => handleCityClick(item.stationId)}
            >
              <div className="col-rank">
                {item.rank !== null ? (
                  <span className={`rank-badge ${item.rank <= 3 ? `rank-${item.rank}` : ''}`}>
                    #{item.rank}
                  </span>
                ) : item.isStale ? (
                  <span className="rank-stale-tag" title="Observation >3h old — excluded from current rankings">
                    Stale
                  </span>
                ) : (
                  <span className="rank-na">—</span>
                )}
              </div>

              <div className="col-city">
                <div className="city-name-group">
                  <span className="city-dot" style={{ backgroundColor: item.pinColor }} />
                  <div>
                    <strong>{item.cityName}</strong>
                    <small>{item.stationName} ({item.provider})</small>
                  </div>
                </div>
              </div>

              <div className="col-pm25">
                {item.hasData ? (
                  <div className="pm25-val-box">
                    <span className="val-text">{item.pm25}</span>
                    <span className="unit-text">µg/m³</span>
                  </div>
                ) : (
                  <span className="text-muted">Sensor Offline</span>
                )}
              </div>

              <div className="col-category">
                {item.hasData ? (
                  <span
                    className="category-pill"
                    style={{
                      backgroundColor: item.category.bgColor,
                      color: item.category.color,
                      borderColor: item.category.borderColor
                    }}
                  >
                    {item.category.label}
                  </span>
                ) : (
                  <span className="category-pill-na">Unavailable</span>
                )}
              </div>

              <div className="col-time">
                {item.hasData ? (
                  <div>
                    <span>{item.measurementTime}</span>
                    {item.isStale ? (
                      <span className="stale-reading-label">Stale · not current (&gt;3h)</span>
                    ) : (
                      <span className="live-reading-label">Live observation</span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted">No recent broadcast</span>
                )}
              </div>

              <div className="col-action">
                <button
                  type="button"
                  className="btn-inspect-station"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCityClick(item.stationId);
                  }}
                >
                  Inspect →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Scientific Integrity Notice */}
      <div className="panel leaderboard-disclaimer-panel">
        <span className="rule-icon">⚖</span>
        <div>
          <strong>Scientific Measurement Standard:</strong>
          <p>
            Rankings reflect authentic physical PM2.5 mass density (µg/m³) published by regional ground monitoring networks (CPCB, HSPCB, DPCC, RSPCB, PPCB, AirNow).
            PM2.5 mass concentration is a physical particulate weight metric, not the composite Air Quality Index (AQI).
            Observations recorded over 3 hours ago are flagged as Stale and excluded from current rankings.
            BreatheWise never fabricates readings or assigns arbitrary zero values to offline stations.
          </p>
        </div>
      </div>
    </div>
  );
}
