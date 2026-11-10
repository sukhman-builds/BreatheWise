import { useMemo } from 'react';
import { getStationById } from '../config/stations.js';
import { toggleFavourite, isFavourite } from '../utils/favorites.js';
import { getPM25Category, formatDateTime, getTimeAgo } from '../utils/pm25Standards.js';

export default function MyLocationsView({
  favourites = [],
  onUpdateFavourites,
  currentStation,
  airQualityMap = {},
  nowTimestamp,
  onSelectStation,
  onNavigateOverview
}) {
  const currentIsFav = useMemo(() => {
    return isFavourite(currentStation.id, favourites);
  }, [currentStation.id, favourites]);

  const handleToggle = (stationId) => {
    const updated = toggleFavourite(stationId, favourites);
    if (onUpdateFavourites) onUpdateFavourites(updated);
  };

  const handleSelect = (stationId) => {
    if (onSelectStation) onSelectStation(stationId);
    if (onNavigateOverview) onNavigateOverview();
  };

  const savedStations = useMemo(() => {
    return favourites
      .map(id => getStationById(id))
      .filter(Boolean);
  }, [favourites]);

  return (
    <div className="my-locations-view">
      {/* 1. Header */}
      <div className="section-heading">
        <div>
          <h2>My Saved Locations</h2>
          <p>
            Quickly monitor, manage, and switch between your bookmarked air quality monitoring sites.
          </p>
        </div>

        <button
          type="button"
          className={`btn-fav-toggle ${currentIsFav ? 'is-fav' : ''}`}
          onClick={() => handleToggle(currentStation.id)}
        >
          {currentIsFav ? '★ Saved: ' : '☆ Bookmark Current: '}
          <strong>{currentStation.shortName || currentStation.cityName}</strong>
        </button>
      </div>

      {/* 2. Saved Locations Grid */}
      {savedStations.length === 0 ? (
        <div className="empty-card my-locations-empty-state">
          <span className="empty-star-icon">☆</span>
          <h3>No Saved Locations Yet</h3>
          <p>
            Bookmark frequently visited cities or neighborhoods for instant one-click air quality checks.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => handleToggle(currentStation.id)}
            style={{ marginTop: '14px' }}
          >
            ★ Save Current Station: {currentStation.name}
          </button>
        </div>
      ) : (
        <div className="saved-stations-grid">
          {savedStations.map((station) => {
            const stationAir = airQualityMap[station.id];
            const pm25 = stationAir?.readings?.find(r => r.pollutant === 'pm25');
            const hasData = pm25 && pm25.value !== null && Number.isFinite(Number(pm25.value));
            const category = getPM25Category(hasData ? pm25.value : null);
            const measurementTime = pm25?.datetime?.local || pm25?.datetime?.utc;
            const isSelected = currentStation.id === station.id;

            return (
              <div
                key={station.id}
                className={`saved-station-card ${isSelected ? 'active-station-card' : ''}`}
              >
                <div className="saved-card-header">
                  <div>
                    <span className="station-city-tag" style={{ borderLeft: `3px solid ${station.pinColor}` }}>
                      {station.cityName}
                    </span>
                    <h4>{station.shortName || station.name}</h4>
                  </div>
                  <button
                    type="button"
                    className="btn-unstar"
                    onClick={() => handleToggle(station.id)}
                    title="Remove from saved locations"
                    aria-label={`Remove ${station.name} from saved locations`}
                  >
                    ★
                  </button>
                </div>

                <p className="saved-locality">{station.locality}</p>
                <p className="saved-meta">Provider: {station.provider} · Network: {station.network}</p>

                <div className="saved-reading-row">
                  <div className="saved-metric">
                    <span className="saved-metric-label">PM2.5 Mass:</span>
                    <strong className="saved-metric-val">
                      {hasData ? `${pm25.value} µg/m³` : (stationAir ? 'Sensor offline' : 'Select to view')}
                    </strong>
                  </div>

                  {hasData && (
                    <span
                      className="category-pill"
                      style={{
                        backgroundColor: category.bgColor,
                        color: category.color,
                        borderColor: category.borderColor
                      }}
                    >
                      {category.label}
                    </span>
                  )}
                </div>

                {measurementTime && (
                  <p className="saved-time">
                    Observed: {formatDateTime(measurementTime)} ({getTimeAgo(measurementTime, nowTimestamp)})
                  </p>
                )}

                <div className="saved-card-footer">
                  <span className="coords-tag">
                    {station.latitude.toFixed(3)}°N, {station.longitude.toFixed(3)}°E
                  </span>
                  <button
                    type="button"
                    className="btn-select-saved"
                    onClick={() => handleSelect(station.id)}
                  >
                    {isSelected ? '✓ Currently Viewing' : 'Switch to Station →'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. LocalStorage persistence notice */}
      <div className="panel telemetry-info-panel" style={{ marginTop: '24px' }}>
        <p className="clean-air-muted">
          ℹ Your saved locations are securely stored in your browser's local storage and persist across visits. No cloud account or tracking is required.
        </p>
      </div>
    </div>
  );
}
