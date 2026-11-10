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

      {/* 3. Leaderboard Table Panel */}
      <div className="panel leaderboard-table-panel">
        <div className="leaderboard-header-row">
          <div>
            <h3>Real-Time City Rankings</h3>
            <p className="table-subtitle">
              Ranked strictly by physical PM2.5 mass density (µg/m³). Stale observations (&gt;3h) excluded from current rankings.
            </p>
          </div>
          <span className="leaderboard-count-badge">
            {leaderboard.currentReportingCount} Active Live Rankings
          </span>
        </div>

        <div className="table-responsive leaderboard-table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th className="col-rank">Rank</th>
                <th className="col-city">City</th>
                <th className="col-site">Monitoring Site</th>
                <th className="col-pm25">PM2.5 Concentration</th>
                <th className="col-category">NAAQS Category</th>
                <th className="col-time">Observation Time</th>
                <th className="col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.cities.map((item) => (
                <tr
                  key={item.cityName}
                  className={`leaderboard-row ${item.rankingStatus === 'current' ? 'row-current' : item.rankingStatus === 'stale' ? 'row-stale' : 'row-unavailable'}`}
                  onClick={() => handleCityClick(item.stationId)}
                >
                  <td className="rank-cell">
                    {item.rank !== null ? (
                      <span className={`rank-badge ${item.rank <= 3 ? `rank-${item.rank}` : ''}`}>
                        #{item.rank}
                      </span>
                    ) : item.isStale ? (
                      <span className="rank-stale-tag" title="Observation >3h old — excluded from current rankings">
                        Stale
                      </span>
                    ) : (
                      <span className="rank-na" title="No sensor reading broadcast">—</span>
                    )}
                  </td>

                  <td className="city-cell">
                    <div className="leaderboard-city-cell-content">
                      <span className="city-dot" style={{ backgroundColor: item.pinColor }} />
                      <strong className="leaderboard-city-name">{item.cityName}</strong>
                    </div>
                  </td>

                  <td className="site-cell">
                    <div className="leaderboard-station-meta">
                      <span className="station-name-text">{item.stationName}</span>
                      <small className="station-provider-tag">({item.provider})</small>
                    </div>
                  </td>

                  <td className="pm25-cell">
                    {item.hasData ? (
                      <div className="pm25-val-box">
                        <span className="pm25-val-bold">{item.pm25}</span>
                        <span className="unit-text">µg/m³</span>
                      </div>
                    ) : (
                      <span className="text-muted-offline">Sensor Offline</span>
                    )}
                  </td>

                  <td className="category-cell">
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
                  </td>

                  <td className="time-cell">
                    {item.hasData ? (
                      <div className="time-cell-content">
                        <span className="time-text">{item.measurementTime}</span>
                        {item.isStale ? (
                          <span className="status-pill stale">Stale (&gt;3h)</span>
                        ) : (
                          <span className="status-pill live">Live</span>
                        )}
                      </div>
                    ) : (
                      <div className="time-cell-content">
                        <span className="status-pill unavailable">Offline</span>
                      </div>
                    )}
                  </td>

                  <td className="action-cell">
                    <button
                      type="button"
                      className="btn-inspect-station"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCityClick(item.stationId);
                      }}
                      title={`Inspect ${item.cityName}`}
                    >
                      Inspect →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
