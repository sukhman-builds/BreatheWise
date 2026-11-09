import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { formatDateTime } from '../utils/pm25Standards';

// Clean custom pin icon generator using SVG
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
          font-size: 11px;
          font-weight: 800;
          font-family: sans-serif;
        ">${label}</span>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34]
  });
}

const delhiIcon = createCustomPin('#1b5e20', 'DEL');
const ambalaIcon = createCustomPin('#00695c', 'AMB');

// Helper to smooth pan map
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, zoom, { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function MapView({ activeStationId, onSelectStation, delhiData, ambalaData }) {
  const stations = [
    {
      id: 8118,
      name: 'New Delhi (AirNow / US Diplomatic Post)',
      locality: 'Chanakyapuri, Central Delhi, NCR',
      provider: 'AirNow (OpenAQ Provider ID: 119)',
      operator: 'U.S. Diplomatic Post monitor via AirNow',
      latitude: 28.63576,
      longitude: 77.22445,
      icon: delhiIcon,
      data: delhiData
    },
    {
      id: 6964,
      name: 'Patti Mehar, Ambala - HSPCB',
      locality: 'Ambala, Haryana (Within 25 km discovery radius)',
      provider: 'CPCB (OpenAQ Provider ID: 168)',
      operator: 'Haryana State Pollution Control Board (HSPCB) / CPCB',
      latitude: 30.379589,
      longitude: 76.778328,
      icon: ambalaIcon,
      data: ambalaData
    }
  ];

  const currentStation = stations.find(s => s.id === activeStationId) || stations[0];
  const mapCenter = [currentStation.latitude, currentStation.longitude];

  return (
    <div className="map-view">
      <div className="section-heading">
        <div>
          <h2>Interactive Air Quality Monitoring Map</h2>
          <p>Real ground-based monitoring stations in New Delhi and the Ambala 25 km discovery corridor</p>
        </div>
      </div>

      <div className="map-layout-grid">
        {/* Map Panel */}
        <div className="panel map-leaflet-panel">
          <MapContainer
            center={mapCenter}
            zoom={9}
            scrollWheelZoom={true}
            style={{ height: '480px', width: '100%', borderRadius: '12px' }}
          >
            <MapController center={mapCenter} zoom={activeStationId ? 11 : 8} />

            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* 25 km Discovery Radius around Ambala */}
            <Circle
              center={[30.378, 76.776]}
              radius={25000}
              pathOptions={{
                color: '#00897b',
                fillColor: '#80cbc4',
                fillOpacity: 0.15,
                weight: 1.5,
                dashArray: '5, 5'
              }}
            >
              <Popup>
                <strong>Ambala 25 km Discovery Radius</strong><br />
                Search perimeter for genuine ambient air quality stations.
              </Popup>
            </Circle>

            {/* Station Markers */}
            {stations.map(station => {
              const pm25 = station.data?.readings?.find(r => r.pollutant === 'pm25');
              const measurementTime = pm25?.datetime?.local || pm25?.datetime?.utc;

              return (
                <Marker
                  key={station.id}
                  position={[station.latitude, station.longitude]}
                  icon={station.icon}
                >
                  <Popup>
                    <div className="map-popup-card">
                      <h4>{station.name}</h4>
                      <p className="popup-sub">
                        <strong>OpenAQ Provider:</strong> {station.provider}<br />
                        <strong>Network Operator:</strong> {station.operator}
                      </p>

                      <div className="popup-reading">
                        <span className="popup-label">Latest PM2.5:</span>
                        <strong>{pm25 ? `${pm25.value} µg/m³` : 'Reading unavailable'}</strong>
                      </div>

                      {measurementTime && (
                        <p className="popup-time">
                          Measured: {formatDateTime(measurementTime)}
                        </p>
                      )}

                      <p className="popup-coords">
                        Coords: {station.latitude.toFixed(4)}°N, {station.longitude.toFixed(4)}°E
                      </p>

                      <button
                        className="btn-select-map-station"
                        onClick={() => onSelectStation(station.id)}
                      >
                        {activeStationId === station.id ? '✓ Selected Station' : 'Select This Station'}
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
            <h3>Verified Monitoring Stations</h3>
            <span className="pill-badge">2 ACTIVE SITES</span>
          </div>

          <div className="station-cards-stack">
            {stations.map(station => {
              const isSelected = activeStationId === station.id;
              const pm25 = station.data?.readings?.find(r => r.pollutant === 'pm25');

              return (
                <div
                  className={`station-list-card ${isSelected ? 'selected' : ''}`}
                  key={station.id}
                  onClick={() => onSelectStation(station.id)}
                >
                  <div className="station-list-header">
                    <h4>{station.name}</h4>
                    <span className={`status-dot ${isSelected ? 'active' : ''}`}></span>
                  </div>

                  <p className="station-meta-desc">{station.locality}</p>
                  <p className="station-meta-desc"><strong>Provider:</strong> {station.provider}</p>
                  <p className="station-meta-desc"><strong>Operator:</strong> {station.operator}</p>

                  <div className="station-list-metric">
                    <span>PM2.5 Mass:</span>
                    <strong>{pm25 ? `${pm25.value} µg/m³` : '—'}</strong>
                  </div>

                  <div className="station-footer-action">
                    <span className="coords-tag">
                      {station.latitude.toFixed(3)}°N, {station.longitude.toFixed(3)}°E
                    </span>
                    <span className="action-link">
                      {isSelected ? 'Active View' : 'Focus on Map →'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="map-legend-card">
            <h4>Map Indicators</h4>
            <div className="legend-row">
              <span className="legend-circle" style={{ backgroundColor: '#1b5e20' }}></span>
              <span>New Delhi Monitor (8118)</span>
            </div>
            <div className="legend-row">
              <span className="legend-circle" style={{ backgroundColor: '#00695c' }}></span>
              <span>Ambala Monitor (6964)</span>
            </div>
            <div className="legend-row">
              <span className="legend-circle dashed" style={{ borderColor: '#00897b' }}></span>
              <span>25 km Discovery Perimeter around Ambala</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
