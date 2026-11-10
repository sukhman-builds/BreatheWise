import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { formatDateTime, getTimeAgo } from '../utils/pm25Standards';
import {
  SUPPORTED_STATIONS,
  SUPPORTED_CITIES,
  getStationById
} from '../config/stations';

// Clean custom pin icon generator using SVG with customizable color & label
function createCustomPin(color, label) {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="
        background-color: ${color};
        width: 34px;
        height: 34px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        box-shadow: 0 3px 8px rgba(0,0,0,0.3);
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-size: 10px;
          font-weight: 800;
          font-family: sans-serif;
          letter-spacing: -0.5px;
        ">${label}</span>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34]
  });
}

// Cache pin icons by color and label to avoid re-creating DOM nodes
const pinCache = new Map();
function getStationPin(station) {
  const key = `${station.pinColor || '#1b5e20'}-${station.pinLabel || 'AQI'}`;
  if (!pinCache.has(key)) {
    pinCache.set(key, createCustomPin(station.pinColor || '#1b5e20', station.pinLabel || 'AQI'));
  }
  return pinCache.get(key);
}

// Helper to smooth pan map
function MapController({ center, zoom }) {
  const map = useMap();
  const lat = center?.[0];
  const lng = center?.[1];

  useEffect(() => {
    if (lat != null && lng != null) {
      map.flyTo([lat, lng], zoom, { duration: 1.2 });
    }
  }, [lat, lng, zoom, map]);
  return null;
}

export default function MapView({
  activeStationId,
  nowTimestamp,
  onSelectStation,
  delhiData,
  ambalaData,
  stationsAirMap = {}
}) {
  const [cityFilter, setCityFilter] = useState('ALL');
  const [showMobileStations, setShowMobileStations] = useState(false);

  // Merge backward-compatible props into the air data lookup
  const airLookup = useMemo(() => {
    const map = { ...stationsAirMap };
    if (delhiData && !map[8118]) map[8118] = delhiData;
    if (ambalaData && !map[6964]) map[6964] = ambalaData;
    return map;
  }, [stationsAirMap, delhiData, ambalaData]);

  const currentStation = getStationById(activeStationId || 8118);
  const mapCenter = useMemo(
    () => [currentStation.latitude, currentStation.longitude],
    [currentStation.latitude, currentStation.longitude]
  );

  const handleStationSelect = (stationId) => {
    onSelectStation(stationId);
    if (typeof window !== 'undefined' && window.innerWidth <= 1023) {
      const mapElem = document.querySelector('.map-leaflet-panel');
      if (mapElem) {
        mapElem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  // Filter stations for the sidebar list
  const displayedStations = useMemo(() => {
    if (cityFilter === 'ALL') return SUPPORTED_STATIONS;
    return SUPPORTED_STATIONS.filter(s => s.cityName.toLowerCase() === cityFilter.toLowerCase());
  }, [cityFilter]);

  return (
    <div className="map-view">
      <div className="section-heading">
        <div>
          <h2>Interactive Air Quality Monitoring Map</h2>
          <p>
            Real ground-based monitoring stations across {SUPPORTED_CITIES.length} verified cities in Northern India
          </p>
        </div>
        <div className="selected-station-pill">
          <span className="live-dot" style={{ backgroundColor: currentStation.pinColor || '#1b5e20' }}></span>
          <span>Active: <strong>{currentStation.cityName}</strong> · {currentStation.shortName}</span>
        </div>
      </div>

      <div className="map-layout-grid">
        {/* Map Panel */}
        <div className="panel map-leaflet-panel">
          <MapContainer
            center={mapCenter}
            zoom={9}
            scrollWheelZoom={true}
            className="leaflet-map-responsive"
          >
            <MapController center={mapCenter} zoom={activeStationId ? 11 : 7} />

            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* 25 km Discovery Radius around Ambala reference coordinates */}
            <Circle
              center={[30.378, 76.776]}
              radius={25000}
              pathOptions={{
                color: '#00897b',
                fillColor: '#80cbc4',
                fillOpacity: 0.12,
                weight: 1.5,
                dashArray: '5, 5'
              }}
            >
              <Popup>
                <strong>Ambala 25 km Discovery Radius</strong><br />
                Search perimeter for authentic ambient air quality stations.
              </Popup>
            </Circle>

            {/* Render all verified monitoring stations */}
            {SUPPORTED_STATIONS.map(station => {
              const stationAir = airLookup[station.id];
              const pm25 = stationAir?.readings?.find(r => r.pollutant === 'pm25');
              const measurementTime = pm25?.datetime?.local || pm25?.datetime?.utc;
              const measurementAgeHours = measurementTime
                ? (nowTimestamp - new Date(measurementTime).getTime()) / 3600000
                : null;
              const isStale = measurementAgeHours !== null && measurementAgeHours > 3;
              const isSelected = activeStationId === station.id;

              return (
                <Marker
                  key={station.id}
                  position={[station.latitude, station.longitude]}
                  icon={getStationPin(station)}
                >
                  <Popup>
                    <div className="map-popup-card">
                      <div className="popup-badge" style={{ backgroundColor: station.pinColor, color: 'white' }}>
                        {station.cityName}
                      </div>
                      <h4>{station.name}</h4>
                      <p className="popup-sub">
                        <strong>Provider:</strong> {station.provider}<br />
                        <strong>Network:</strong> {station.network}
                      </p>

                      <div className="popup-reading">
                        <span className="popup-label">{isStale ? 'Last observed PM2.5:' : 'Latest PM2.5:'}</span>
                        <strong>{pm25 ? `${pm25.value} µg/m³` : (stationAir ? 'Reading unavailable' : 'Select to view')}</strong>
                      </div>

                      {measurementTime && (
                        <p className="popup-time">
                          Observed: {formatDateTime(measurementTime)}
                          {isStale && <span className="stale-reading-label">Stale · {getTimeAgo(measurementTime, nowTimestamp)} · not current</span>}
                        </p>
                      )}

                      <p className="popup-coords">
                        Coords: {station.latitude.toFixed(4)}°N, {station.longitude.toFixed(4)}°E
                      </p>

                      <button
                        className="btn-select-map-station"
                        onClick={() => onSelectStation(station.id)}
                      >
                        {isSelected ? '✓ Selected Station' : 'Select This Station'}
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Stations Side List */}
        <div className="panel map-sidebar-panel">
          <div className="panel-title-bar">
            <div>
              <h3>Verified Monitoring Stations</h3>
              <p className="sidebar-subtitle">Filter by city or click to focus</p>
            </div>
            <span className="pill-badge">{displayedStations.length} SITES</span>
          </div>

          {/* Mobile Collapsible Toggle Button (< 1024px) */}
          <button
            type="button"
            className="mobile-station-list-toggle-btn"
            onClick={() => setShowMobileStations(prev => !prev)}
            aria-expanded={showMobileStations}
          >
            <span>{showMobileStations ? '▲ Hide Station List' : `▼ Browse All Stations (${displayedStations.length})`}</span>
          </button>

          <div className={`map-stations-body ${showMobileStations ? 'mobile-visible' : ''}`}>
            {/* City filter pills */}
            <div className="city-filter-bar">
              <button
                type="button"
                className={`city-pill-btn ${cityFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setCityFilter('ALL')}
              >
                All ({SUPPORTED_STATIONS.length})
              </button>
              {SUPPORTED_CITIES.map(city => {
                const count = SUPPORTED_STATIONS.filter(s => s.cityName === city).length;
                return (
                  <button
                    key={city}
                    type="button"
                    className={`city-pill-btn ${cityFilter === city ? 'active' : ''}`}
                    onClick={() => setCityFilter(city)}
                  >
                    {city} ({count})
                  </button>
                );
              })}
            </div>

            <div className="station-cards-stack">
              {displayedStations.map(station => {
                const isSelected = activeStationId === station.id;
                const stationAir = airLookup[station.id];
                const pm25 = stationAir?.readings?.find(r => r.pollutant === 'pm25');
                const measurementTime = pm25?.datetime?.local || pm25?.datetime?.utc;
                const measurementAgeHours = measurementTime
                  ? (nowTimestamp - new Date(measurementTime).getTime()) / 3600000
                  : null;
                const isStale = measurementAgeHours !== null && measurementAgeHours > 3;

                return (
                  <div
                    className={`station-list-card ${isSelected ? 'selected' : ''}`}
                    key={station.id}
                    onClick={() => handleStationSelect(station.id)}
                  >
                    <div className="station-list-header">
                      <div>
                        <span className="station-city-tag" style={{ borderLeft: `3px solid ${station.pinColor}` }}>
                          {station.cityName}
                        </span>
                        <h4>{station.shortName || station.name}</h4>
                      </div>
                      <span className={`status-dot ${isSelected ? 'active' : ''}`}></span>
                    </div>

                    <p className="station-meta-desc">{station.name}</p>
                    <p className="station-meta-desc"><strong>Network:</strong> {station.network}</p>

                    <div className="station-list-metric">
                      <span>{isStale ? 'Last PM2.5:' : 'PM2.5 Mass:'}</span>
                      <strong>{pm25 ? `${pm25.value} µg/m³` : (stationAir ? '—' : 'Click to inspect')}</strong>
                    </div>
                    {isStale && measurementTime && (
                      <small className="station-stale-note">
                        Stale · {getTimeAgo(measurementTime, nowTimestamp)} · not current
                      </small>
                    )}

                    <div className="station-footer-action">
                      <span className="coords-tag">
                        {station.latitude.toFixed(3)}°N, {station.longitude.toFixed(3)}°E
                      </span>
                      <span className="action-link">
                        {isSelected ? '✓ Active View' : 'Focus on Map →'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="map-legend-card">
              <h4>Map Indicators & Networks</h4>
              <div className="legend-row">
                <span className="legend-circle" style={{ backgroundColor: '#1b5e20' }}></span>
                <span>AirNow / U.S. Diplomatic Post (8118)</span>
              </div>
              <div className="legend-row">
                <span className="legend-circle" style={{ backgroundColor: '#00695c' }}></span>
                <span>CPCB / HSPCB Stations (Ambala, Gurugram, Faridabad)</span>
              </div>
              <div className="legend-row">
                <span className="legend-circle" style={{ backgroundColor: '#0277bd' }}></span>
                <span>CPCC Chandigarh Stations</span>
              </div>
              <div className="legend-row">
                <span className="legend-circle" style={{ backgroundColor: '#d84315' }}></span>
                <span>RSPCB Rajasthan Stations (Jaipur)</span>
              </div>
              <div className="legend-row">
                <span className="legend-circle dashed" style={{ borderColor: '#00897b' }}></span>
                <span>25 km Perimeter around Ambala</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
