import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './App.css';
import {
  fetchAirQuality,
  fetchLocationMeta,
  fetchHistory as apiFetchHistory,
  fetchAmbalaStations,
  fetchForecast,
  RateLimitError
} from './api/client';
import { calculate24HourStats, getSnapshotAdvisory, formatDateTime, getTimeAgo } from './utils/pm25Standards';
import {
  SUPPORTED_STATIONS,
  SUPPORTED_CITIES,
  DEFAULT_STATION_ID,
  getStationById,
  getStationsByCity,
  getDefaultStationForCity,
  getCityForStation
} from './config/stations';

import CompareView from './components/CompareView';
import TrendsView from './components/TrendsView';
import MapView from './components/MapView';
import HealthView from './components/HealthView';
import ForecastView from './components/ForecastView';
import AlertsView from './components/AlertsView';
import CleanAirWindow from './components/CleanAirWindow';
import ReliabilityView from './components/ReliabilityView';
import LeaderboardView from './components/LeaderboardView';
import MyLocationsView from './components/MyLocationsView';
import WeeklyReportView from './components/WeeklyReportView';
import { evaluateStationAlert, recordAlertEvent, ALERT_STATUS } from './utils/smartAlerts';
import { loadFavourites, saveFavourites, toggleFavourite, isFavourite } from './utils/favorites';

// Standard pollutants definition
const pollutants = [
  { name: 'PM2.5', key: 'pm25', description: 'Fine inhalable particles (<2.5 µm)' },
  { name: 'PM10', key: 'pm10', description: 'Coarse inhalable particles (<10 µm)' },
  { name: 'NO₂', key: 'no2', description: 'Nitrogen dioxide from fossil fuels' },
  { name: 'SO₂', key: 'so2', description: 'Sulphur dioxide from power/industry' },
  { name: 'CO', key: 'co', description: 'Carbon monoxide from incomplete burn' },
  { name: 'O₃', key: 'o3', description: 'Ground-level photochemical ozone' },
];

// Navigation sections configuration
const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: '▦' },
  { id: 'map', label: 'Air Quality Map', icon: '⌖' },
  { id: 'leaderboard', label: 'PM2.5 Leaderboard', icon: '🏆' },
  { id: 'saved', label: 'My Locations', icon: '★' },
  { id: 'trends', label: 'Historical Trends', icon: '▤' },
  { id: 'report', label: 'Weekly Report', icon: '📄' },
  { id: 'compare', label: 'Compare Cities', icon: '⇄' },
  { id: 'forecast', label: 'Forecast', icon: '☼' },
  { id: 'alerts', label: 'Smart Alerts', icon: '🔔' },
  { id: 'health', label: 'Health & Safety', icon: '♡' },
  { id: 'reliability', label: 'Data Reliability', icon: '📡' },
];

// Custom marker pins generator for Leaflet
function createPin(color, label) {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
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
        ">${label}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
}

const pinCache = new Map();
function getStationPin(station) {
  const key = `${station.pinColor || '#1b5e20'}-${station.pinLabel || 'AQI'}`;
  if (!pinCache.has(key)) {
    pinCache.set(key, createPin(station.pinColor || '#1b5e20', station.pinLabel || 'AQI'));
  }
  return pinCache.get(key);
}

export default function App() {
  const [activeNav, setActiveNav] = useState(() => {
    try {
      const param = new URLSearchParams(window.location.search).get('tab');
      if (param && ['overview', 'map', 'trends', 'compare', 'alerts', 'health', 'forecast', 'leaderboard', 'saved', 'report', 'reliability'].includes(param)) {
        return param;
      }
    } catch {
      // fallback
    }
    return 'overview';
  });

  // Global selected location ID with URL persistence support
  const [selectedLocationId, setSelectedLocationId] = useState(() => {
    try {
      const param = new URLSearchParams(window.location.search).get('station');
      if (param && /^\d+$/.test(param)) {
        const id = Number(param);
        if (SUPPORTED_STATIONS.some(s => s.id === id)) {
          return id;
        }
      }
      const cityParam = new URLSearchParams(window.location.search).get('city');
      if (cityParam) {
        const st = getDefaultStationForCity(cityParam);
        if (st) return st.id;
      }
    } catch {
      // fallback
    }
    return DEFAULT_STATION_ID;
  });

  // Selected city derived or selected
  const [selectedCity, setSelectedCity] = useState(() => getCityForStation(selectedLocationId));

  // Current station configuration
  const currentStation = useMemo(() => {
    return getStationById(selectedLocationId);
  }, [selectedLocationId]);

  // Stations available in the current city
  const stationsInCurrentCity = useMemo(() => {
    return getStationsByCity(selectedCity);
  }, [selectedCity]);

  // Mobile navigation drawer open/close state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile navigation drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.classList.add('nav-drawer-open');
    } else {
      document.body.classList.remove('nav-drawer-open');
    }
    return () => {
      document.body.classList.remove('nav-drawer-open');
    };
  }, [mobileMenuOpen]);

  // Current timestamp stored in state to strictly honor React 19 pure component rules
  const [now, setNow] = useState(() => Date.now());

  // Cached data maps to avoid redundant API queries when switching views/tabs
  const [airQualityMap, setAirQualityMap] = useState({});
  const [historyMap, setHistoryMap] = useState({});
  const [locationMetaMap, setLocationMetaMap] = useState({});
  const [ambalaDiscovery, setAmbalaDiscovery] = useState(null);

  // Status states for current station
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [rateLimitCountdown, setRateLimitCountdown] = useState(null);

  // Persistent Smart AQI Alert History
  const [alertHistory, setAlertHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('breathewise_alert_history');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('breathewise_alert_history', JSON.stringify(alertHistory));
    } catch {
      // ignore in environments without localStorage
    }
  }, [alertHistory]);

  // Saved locations (favourites) persisted in localStorage
  const [favourites, setFavourites] = useState(() => {
    return loadFavourites();
  });

  const handleUpdateFavourites = useCallback((newFavs) => {
    setFavourites(newFavs);
    saveFavourites(newFavs);
  }, []);

  // Stabilized callback for updating airQualityMap from child components
  const handleAirQualityUpdate = useCallback((newMap) => {
    setAirQualityMap(prev => ({ ...prev, ...newMap }));
  }, []);

  // Forecast data map for Clean Air Window computation
  const [forecastMap, setForecastMap] = useState({});
  const [forecastLoading, setForecastLoading] = useState(false);

  // Update current time clock every 60s
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Sync URL search params
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', activeNav);
      url.searchParams.set('city', selectedCity);
      url.searchParams.set('station', String(selectedLocationId));
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore in tests or non-browser environments
    }
  }, [activeNav, selectedCity, selectedLocationId]);

  // Ref to cancel obsolete in-flight requests when switching stations
  const activeStationAbortRef = useRef(null);

  // Fetch air quality and location details for the active station
  const fetchStationData = useCallback(async (locationId, force = false, signal = null) => {
    const station = getStationById(locationId);
    if (!station) return;

    await Promise.resolve();
    if (signal?.aborted) return;
    setLoading(true);
    setError('');

    try {
      const [aqData, locData] = await Promise.all([
        fetchAirQuality(locationId, { force, signal }),
        fetchLocationMeta(locationId, { force, signal }).catch(() => null)
      ]);

      setAirQualityMap(prev => ({
        ...prev,
        [locationId]: aqData
      }));

      if (locData) {
        setLocationMetaMap(prev => ({
          ...prev,
          [locationId]: locData
        }));
      }

      setError('');
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (err instanceof RateLimitError) {
        setRateLimitCountdown(err.retryAfter || 30);
      }
      setError(err.message || 'Error communicating with backend API.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch historical PM2.5 measurements for active station
  const fetchHistory = useCallback(async (sensorId, force = false, signal = null) => {
    if (!sensorId) {
      setHistoryLoading(false);
      return;
    }

    await Promise.resolve();
    if (signal?.aborted) return;
    setHistoryLoading(true);
    setHistoryError('');

    try {
      const data = await apiFetchHistory(sensorId, { force, signal });
      setHistoryMap(prev => ({
        ...prev,
        [sensorId]: data.measurements || []
      }));
      setHistoryError('');
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (err instanceof RateLimitError) {
        setRateLimitCountdown(err.retryAfter || 30);
      }
      setHistoryError(err.message || 'Failed to retrieve historical timeline.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Load active station data concurrently with obsolete-request cancellation
  useEffect(() => {
    if (activeStationAbortRef.current) {
      activeStationAbortRef.current.abort();
    }
    const controller = new AbortController();
    activeStationAbortRef.current = controller;

    async function loadActiveStation() {
      const promises = [
        fetchStationData(selectedLocationId, false, controller.signal),
        currentStation.pm25SensorId ? fetchHistory(currentStation.pm25SensorId, false, controller.signal) : Promise.resolve()
      ];

      if (currentStation.latitude && currentStation.longitude) {
        setForecastLoading(true);
        promises.push(
          fetchForecast(currentStation.latitude, currentStation.longitude, { signal: controller.signal })
            .then(data => {
              if (!controller.signal.aborted) {
                setForecastMap(prev => ({ ...prev, [selectedLocationId]: data }));
              }
            })
            .catch(() => {})
            .finally(() => {
              if (!controller.signal.aborted) {
                setForecastLoading(false);
              }
            })
        );
      }

      await Promise.allSettled(promises);
    }

    loadActiveStation();

    return () => {
      controller.abort();
    };
  }, [selectedLocationId, currentStation.pm25SensorId, currentStation.latitude, currentStation.longitude, fetchStationData, fetchHistory]);

  // Load Ambala discovery once on mount
  useEffect(() => {
    let isMounted = true;
    fetchAmbalaStations()
      .then(data => {
        if (isMounted && data) setAmbalaDiscovery(data);
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Rate limit countdown handler
  useEffect(() => {
    if (rateLimitCountdown === null || rateLimitCountdown <= 0) return;
    const timer = setTimeout(() => {
      if (rateLimitCountdown === 1) {
        setRateLimitCountdown(null);
        fetchStationData(selectedLocationId, true);
        if (currentStation.pm25SensorId) {
          fetchHistory(currentStation.pm25SensorId, true);
        }
      } else {
        setRateLimitCountdown(rateLimitCountdown - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [rateLimitCountdown, selectedLocationId, currentStation.pm25SensorId, fetchStationData, fetchHistory]);

  // Handle city selection change
  const handleCityChange = (cityName) => {
    const defaultStation = getDefaultStationForCity(cityName);
    setSelectedCity(cityName);
    setSelectedLocationId(defaultStation.id);
  };

  // Handle station selection change
  const handleStationSelect = (locationId) => {
    const station = getStationById(locationId);
    if (!station) return;
    setSelectedLocationId(station.id);
    setSelectedCity(station.cityName);
  };

  // Active station data
  const currentAir = airQualityMap[selectedLocationId] || null;
  const currentLoc = locationMetaMap[selectedLocationId] || currentStation;
  const currentHistory = currentStation.pm25SensorId
    ? (historyMap[currentStation.pm25SensorId] || [])
    : [];

  const readings = currentAir?.readings || [];
  const pm25 = readings.find(item => item.pollutant === 'pm25');
  const measurementTime = pm25?.datetime?.local || pm25?.datetime?.utc;
  const fetchTime = currentAir?.fetchedAt;

  // Stale measurement calculation using pure state timestamp or upstream stale flag
  const ageHours = measurementTime
    ? (now - new Date(measurementTime).getTime()) / 3600000
    : null;
  const isStale = Boolean(currentAir?.isStale) || (ageHours !== null && ageHours > 3);

  const pm25Snapshot = getSnapshotAdvisory(pm25?.value);
  const stats24h = calculate24HourStats(currentHistory, now);

  // Smart AQI Alert Evaluation for the selected monitoring site
  const alertEvaluation = useMemo(() => {
    return evaluateStationAlert({
      station: currentStation,
      stats24h,
      isStale,
      latestObservationTime: measurementTime,
      nowTimestamp: now,
      loading: loading || historyLoading,
      apiError: error || historyError
    });
  }, [currentStation, stats24h, isStale, measurementTime, now, loading, historyLoading, error, historyError]);

  // Record active alerts in history if not already logged
  useEffect(() => {
    if (alertEvaluation.status === ALERT_STATUS.ACTIVE_ALERT && alertEvaluation.alert) {
      const activeAlert = alertEvaluation.alert;
      const timer = setTimeout(() => {
        setAlertHistory(prev => recordAlertEvent(prev, activeAlert));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [alertEvaluation]);

  const handleDismissAlert = useCallback((alertId, isDismissed = true) => {
    setAlertHistory(prev => {
      return prev.map(item => {
        if (item.id === alertId) {
          return {
            ...item,
            isDismissed,
            dismissedAt: isDismissed ? Date.now() : null
          };
        }
        return item;
      });
    });
  }, []);

  const handleClearAlertHistory = useCallback(() => {
    setAlertHistory([]);
  }, []);

  const activeAlertsCount = useMemo(() => {
    return alertHistory.filter(item => !item.isDismissed).length;
  }, [alertHistory]);

  // Dynamic greeting based on Indian Standard Time (IST)
  const istHour = (() => {
    try {
      const timeStr = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hour12: false
      }).format(new Date(now));
      return parseInt(timeStr, 10);
    } catch {
      return 12;
    }
  })();

  const greeting = istHour >= 4 && istHour < 12
    ? 'Good morning'
    : istHour >= 12 && istHour < 17
      ? 'Good afternoon'
      : 'Good evening';

  // Chart data: 24 available readings
  const chartData = [...currentHistory]
    .filter(item => item.value !== null && Number.isFinite(Number(item.value)))
    .slice(0, 24)
    .reverse();

  const maxValue = Math.max(...chartData.map(item => Number(item.value)), 1);
  const latestHistory = currentHistory[0];

  return (
    <div className="app">
      {/* Mobile Top Navigation Bar (< 1024px) */}
      <header className="mobile-header-bar">
        <div
          className="mobile-header-brand"
          onClick={() => {
            setActiveNav('overview');
            setMobileMenuOpen(false);
          }}
          role="button"
          tabIndex={0}
        >
          <span className="brand-icon">✳</span>
          <span className="brand-title">BreatheWise</span>
        </div>

        <div className="mobile-header-actions">
          <div className="mobile-active-city-badge">
            <span className="city-dot" style={{ backgroundColor: currentStation.pinColor || '#1b5e20' }}></span>
            <span>{currentStation.cityName}</span>
          </div>

          <button
            type="button"
            className={`mobile-hamburger-btn ${mobileMenuOpen ? 'open' : ''}`}
            onClick={() => setMobileMenuOpen(prev => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            <span className="hamburger-bar"></span>
            <span className="hamburger-bar"></span>
            <span className="hamburger-bar"></span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer Backdrop & Modal (< 1024px) */}
      {mobileMenuOpen && (
        <div
          className="mobile-nav-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`mobile-nav-drawer ${mobileMenuOpen ? 'open' : ''}`} aria-label="Mobile Navigation">
        <div className="mobile-drawer-header">
          <div className="brand">
            <span className="brand-icon">✳</span>
            <span>BreatheWise</span>
          </div>
          <button
            type="button"
            className="mobile-drawer-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            ✕
          </button>
        </div>

        <p className="menu-label">WORKSPACE</p>

        <nav className="mobile-nav-links">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              type="button"
              className={`mobile-nav-item ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => {
                setActiveNav(item.id);
                setMobileMenuOpen(false);
              }}
            >
              <span className="nav-item-icon">{item.icon}</span>
              <span className="nav-item-text">{item.label}</span>
              {item.id === 'alerts' && activeAlertsCount > 0 && (
                <span className="nav-alert-badge" title={`${activeAlertsCount} active alert(s)`}>
                  {activeAlertsCount}
                </span>
              )}
              {activeNav === item.id && <span className="nav-item-active-dot">●</span>}
            </button>
          ))}
        </nav>

        <div className="mobile-drawer-footer">
          <div className="mobile-station-badge">
            <span className="city-dot" style={{ backgroundColor: currentStation.pinColor || '#1b5e20' }}></span>
            <div className="mobile-station-text">
              <strong>{currentStation.cityName}</strong>
              <small>{currentStation.shortName || currentStation.name}</small>
            </div>
          </div>
          <div
            className="api-status-row interactive-status"
            onClick={() => {
              setActiveNav('reliability');
              setMobileMenuOpen(false);
            }}
            title="Click to view Data Reliability & Telemetry Monitor"
            role="button"
            tabIndex={0}
          >
            <span
              className="live-dot"
              style={{
                backgroundColor: loading ? '#e7bd62' : error ? '#ef5350' : '#4caf50'
              }}
            ></span>
            <span>{loading ? 'Syncing OpenAQ...' : error ? 'API Issue' : 'Live Data Connected'}</span>
            <span className="api-status-arrow">→</span>
          </div>
          <p className="mobile-footnote">Verified ground observations from OpenAQ v3</p>
        </div>
      </aside>

      {/* Desktop Sidebar Navigation (>= 1024px) */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">✳</span>
          <span>BreatheWise</span>
        </div>

        <p className="menu-label">WORKSPACE</p>

        <nav>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => setActiveNav(item.id)}
            >
              <span className="nav-item-inner">
                <span>{item.icon} {item.label}</span>
                {item.id === 'alerts' && activeAlertsCount > 0 && (
                  <span className="nav-alert-badge" title={`${activeAlertsCount} active alert(s)`}>
                    {activeAlertsCount}
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div
            className="api-status-row interactive-status"
            onClick={() => setActiveNav('reliability')}
            title="Click to view Data Reliability & Telemetry Monitor"
            role="button"
            tabIndex={0}
          >
            <span
              className="live-dot"
              style={{
                backgroundColor: loading ? '#e7bd62' : error ? '#ef5350' : '#4caf50'
              }}
            ></span>
            <span>{loading ? 'Syncing OpenAQ...' : error ? 'API Issue' : 'Live Data Connected'}</span>
            <span className="api-status-arrow">→</span>
          </div>
          <p>Verified ground observations from OpenAQ v3</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Topbar with Global City & Station Selector */}
        <header className="topbar">
          <div>
            <p className="eyebrow">AIR QUALITY INTELLIGENCE</p>
            <h1>{greeting} 🌿</h1>
            <p className="subtitle">
              Welcome to BreatheWise · Real ground observations. Objective data. Evidence-based health guidance.
            </p>
          </div>

          {/* Global City Dropdown & Station Dropdown */}
          <div className="global-city-selector-wrap">
            <div className="city-selector-box">
              <span className="location-pin-icon">📍</span>
              <div className="city-select-field">
                <label htmlFor="citySelect" className="selector-label">CITY:</label>
                <select
                  id="citySelect"
                  value={selectedCity}
                  onChange={(e) => handleCityChange(e.target.value)}
                  className="city-dropdown"
                >
                  {SUPPORTED_CITIES.map(cityName => (
                    <option key={cityName} value={cityName}>
                      {cityName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Station dropdown if multiple stations exist in the city, or display the station name */}
            <div className="station-selector-box">
              <span className="location-pin-icon">📡</span>
              <div className="station-select-field">
                <label htmlFor="stationSelect" className="selector-label">MONITORING SITE:</label>
                {stationsInCurrentCity.length > 1 ? (
                  <select
                    id="stationSelect"
                    value={selectedLocationId}
                    onChange={(e) => handleStationSelect(Number(e.target.value))}
                    className="station-dropdown"
                  >
                    {stationsInCurrentCity.map(station => (
                      <option key={station.id} value={station.id}>
                        {station.shortName || station.name} ({station.provider})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="single-station-label" title={currentStation.name}>
                    {currentStation.shortName || currentStation.name}
                  </div>
                )}
              </div>
            </div>

            {/* Clear selected city & station indicator */}
            <div className="city-active-indicator">
              <span className="city-dot" style={{ backgroundColor: currentStation.pinColor || '#1b5e20' }}></span>
              <span className="city-indicator-text">
                <strong>{currentStation.cityName}</strong> · {currentStation.shortName || currentStation.name}
              </span>
            </div>

            {/* Quick Favourite / Bookmark Toggle */}
            <button
              type="button"
              className={`topbar-fav-btn ${isFavourite(selectedLocationId, favourites) ? 'favorited' : ''}`}
              onClick={() => {
                const updated = toggleFavourite(selectedLocationId, favourites);
                handleUpdateFavourites(updated);
              }}
              title={isFavourite(selectedLocationId, favourites) ? 'Remove from Saved Locations' : 'Save to My Locations'}
              aria-label={isFavourite(selectedLocationId, favourites) ? 'Remove from Saved Locations' : 'Save to My Locations'}
            >
              {isFavourite(selectedLocationId, favourites) ? '★' : '☆'}
            </button>
          </div>
        </header>

        {/* Rate Limit Banner */}
        {rateLimitCountdown !== null && (
          <div className="rate-limit-banner">
            <span>⏳ OpenAQ API rate limit reached. Re-querying in {rateLimitCountdown} seconds...</span>
            <button
              type="button"
              className="btn-sm"
              onClick={() => {
                setRateLimitCountdown(null);
                fetchStationData(selectedLocationId, true);
                if (currentStation.pm25SensorId) {
                  fetchHistory(currentStation.pm25SensorId, true);
                }
              }}
            >
              Retry Now
            </button>
          </div>
        )}

        {/* Global Error Banner */}
        {error && rateLimitCountdown === null && (
          <div className="error-banner">
            <span>⚠ {error}</span>
            <button
              type="button"
              className="btn-retry-sm"
              onClick={() => {
                fetchStationData(selectedLocationId, true);
                if (currentStation.pm25SensorId) {
                  fetchHistory(currentStation.pm25SensorId, true);
                }
              }}
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Render Active View */}
        {activeNav === 'overview' && (
          <>
            {/* Welcome Banner */}
            <section className="welcome-banner">
              <div>
                <p className="banner-label">EVIDENCE-BASED AIR QUALITY INTELLIGENCE</p>
                <h2>Breathe better.<br />Live informed in {currentStation.cityName}.</h2>
                <p>
                  Explore verified physical measurements from ground-level ambient monitors.
                  Track real-world historical particulate concentrations and evaluate personal health guidance.
                </p>
              </div>
              <div className="banner-art">🌍</div>
            </section>

            {/* Current Air Quality Card */}
            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>{isStale ? 'Air Quality · Last Observation:' : 'Current Air Quality:'} {currentStation.name}</h2>
                  <p>
                    {isStale
                      ? `Most recent station observation from ${currentStation.locality}; this reading is stale, not current.`
                      : `Observational PM2.5 mass concentration reported by ground sensor in ${currentStation.locality}`}
                  </p>
                </div>
                <div className="tags-group">
                  {isStale && <span className="status-tag stale-tag">STALE DATA · NOT CURRENT</span>}
                  <span className="status-tag">
                    {loading ? 'LOADING' : error ? 'API ERROR' : 'OPENAQ VERIFIED'}
                  </span>
                </div>
              </div>

              <div className="aqi-card">
                <p className="card-label">
                  {isStale
                    ? 'LAST OBSERVED PM2.5 MASS CONCENTRATION · NOT A CURRENT READING'
                    : 'PHYSICAL PM2.5 MASS CONCENTRATION & 24-HOUR ROLLING AVERAGE'}
                </p>

                {loading && !pm25 ? (
                  <div className="card-loading-state">
                    <div className="spinner"></div>
                    <h2>Loading sensor observations...</h2>
                  </div>
                ) : error && !pm25 ? (
                  <div className="card-error-state">
                    <h3>{error}</h3>
                    <button
                      type="button"
                      className="btn-retry-sm"
                      style={{ marginTop: '12px' }}
                      onClick={() => {
                        fetchStationData(selectedLocationId, true);
                        if (currentStation.pm25SensorId) {
                          fetchHistory(currentStation.pm25SensorId, true);
                        }
                      }}
                    >
                      Retry Connection
                    </button>
                  </div>
                ) : pm25 ? (
                  <>
                    {/* Dual Metric Presentation: 24h Average & Latest Observation */}
                    <div className="dual-metric-row">
                      {/* 24-Hour Rolling Average */}
                      <div className="metric-primary-block">
                        <div className="metric-primary-header">
                          <div className="metric-primary-info">
                            <span className="metric-sublabel">24-HOUR ROLLING AVERAGE</span>
                            <div
                              className="aqi-value"
                              style={{
                                color: (stats24h.hasData && stats24h.coverageQuality !== 'insufficient')
                                  ? stats24h.category.color
                                  : '#666'
                              }}
                            >
                              {stats24h.hasData && stats24h.average !== null ? stats24h.average : '—'}
                              <span className="val-unit">µg/m³</span>
                            </div>

                            <div
                              className="category-badge-inline"
                              style={{
                                backgroundColor: (stats24h.hasData && stats24h.coverageQuality !== 'insufficient')
                                  ? stats24h.category.bgColor
                                  : '#f5f5f5',
                                color: (stats24h.hasData && stats24h.coverageQuality !== 'insufficient')
                                  ? stats24h.category.color
                                  : '#666',
                                borderColor: (stats24h.hasData && stats24h.coverageQuality !== 'insufficient')
                                  ? stats24h.category.borderColor
                                  : '#ddd'
                              }}
                            >
                              {stats24h.hasData && stats24h.coverageQuality !== 'insufficient'
                                ? `${stats24h.category.label} — ${stats24h.statusLabel}`
                                : stats24h.statusLabel}
                            </div>
                          </div>

                          <div
                            className="aqi-circle"
                            style={{
                              borderColor: (stats24h.hasData && stats24h.coverageQuality !== 'insufficient')
                                ? stats24h.category.borderColor
                                : '#9e9e9e',
                              color: (stats24h.hasData && stats24h.coverageQuality !== 'insufficient')
                                ? stats24h.category.color
                                : '#757575'
                            }}
                          >
                            <span>PM</span>
                            <small>2.5</small>
                            <span className="circle-sub">
                              {stats24h.hasData && stats24h.coverageQuality !== 'insufficient' ? '24h Avg' : 'No 24h Data'}
                            </span>
                          </div>
                        </div>

                        <p className="coverage-detail-text">
                          ℹ {stats24h.statusDescription}
                        </p>
                      </div>

                      {/* Latest Single Observation */}
                      <div className={`metric-snapshot-block${isStale ? ' stale-measurement' : ''}`}>
                        <div>
                          <span className="metric-sublabel">
                            {isStale ? 'LAST OBSERVED · STALE DATA — NOT CURRENT' : 'LATEST SINGLE READING (SNAPSHOT)'}
                          </span>
                          <div className="snapshot-value-row">
                            <div className="snapshot-value">
                              {pm25.value} <span className="snapshot-unit">µg/m³</span>
                            </div>
                            {isStale && (
                              <span className="stale-reading-label">
                                Stale · {getTimeAgo(measurementTime, now)}
                              </span>
                            )}
                            <div
                              className="category-badge-inline snapshot-badge"
                              style={{
                                backgroundColor: pm25Snapshot.bgColor,
                                color: pm25Snapshot.color,
                                borderColor: pm25Snapshot.borderColor
                              }}
                            >
                              {pm25Snapshot.label}
                            </div>
                          </div>
                        </div>

                        <div className="snapshot-meta-box">
                          <div className="snapshot-time-row">
                            <span className="snapshot-time-label">Observed:</span>
                            <span className="snapshot-time-val">
                              {formatDateTime(measurementTime)}
                              {measurementTime && (
                                <span className="t-relative"> ({getTimeAgo(measurementTime, now)})</span>
                              )}
                            </span>
                          </div>
                          <p className="snapshot-caveat">
                            * {pm25Snapshot.disclaimer}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Scientific Protocol Notice */}
                    <div className="scientific-rule-box">
                      <span className="rule-icon">⚖</span>
                      <p>
                        <strong>Scientific Protocol Notice:</strong> Official CPCB NAAQS concentration categories
                        (e.g. Good, Poor, Very Poor) are evaluated against a <strong>24-hour mean</strong>.
                        A single instantaneous spike or dip does not constitute a confirmed standard category.
                        PM2.5 mass concentration (µg/m³) is a physical density metric, distinct from the composite Air Quality Index (AQI).
                      </p>
                    </div>

                    {/* Distinct Measurement and Fetch Timestamps */}
                    <div className="timestamp-metrics">
                      <div className="timestamp-item">
                        <span className="t-label">Sensor Measurement Time:</span>
                        <strong className="t-val">{formatDateTime(measurementTime)}</strong>
                        {measurementTime && (
                          <span className="t-relative">({getTimeAgo(measurementTime, now)})</span>
                        )}
                      </div>

                      <div className="timestamp-item">
                        <span className="t-label">BreatheWise Proxy Fetch Time:</span>
                        <strong className="t-val">{formatDateTime(fetchTime)}</strong>
                        <span className="t-relative">(Cached upstream)</span>
                      </div>
                    </div>

                    {isStale && (
                      <div className="stale-alert-box">
                        <span>⏱</span>
                        <span>Notice: This measurement was recorded over 3 hours ago. Ambient conditions may have evolved.</span>
                      </div>
                    )}
                  </>
                ) : (
                  <h3>No PM2.5 measurement currently available for this site</h3>
                )}
              </div>
            </section>

            {/* Clean Air Window Recommendation */}
            <section className="section">
              <CleanAirWindow
                hourlyForecast={forecastMap[selectedLocationId]?.hourly || []}
                cityName={currentStation.cityName}
                stationName={currentStation.name}
                loading={forecastLoading}
                error=""
                nowTimestamp={now}
              />
            </section>

            {/* Pollutant Levels Grid */}
            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>Station Pollutant Levels</h2>
                  <p>Measurements reported across all active sensors for {currentStation.name}</p>
                </div>
              </div>

              <div className="pollutant-grid">
                {pollutants.map(item => {
                  const reading = readings.find(data => data.pollutant === item.key);
                  const readingTime = reading?.datetime?.local || reading?.datetime?.utc;
                  const readingAgeHours = readingTime
                    ? (now - new Date(readingTime).getTime()) / 3600000
                    : null;
                  const readingIsStale = readingAgeHours !== null && readingAgeHours > 3;

                  return (
                    <div className={`pollutant-card${readingIsStale ? ' stale-pollutant-card' : ''}`} key={item.key}>
                      <span className="pollutant-name">{item.name}</span>

                      <h3>
                        {loading ? '...' : reading ? reading.value : '—'}
                      </h3>

                      <p>{item.description}</p>

                      <small>
                        {loading
                          ? 'Loading'
                          : reading
                            ? `${reading.unit} · Active Sensor${readingIsStale ? ' · Stale — not current' : ''}`
                            : 'Sensor not reported'}
                      </small>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Historical PM2.5 Trends Panel */}
            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>Recent PM2.5 Timeline: {currentStation.name}</h2>
                  <p>
                    Chronological measurements from sensor {currentStation.pm25SensorId || 'N/A'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => setActiveNav('trends')}
                >
                  View Full Trends & Analytics →
                </button>
              </div>

              <div className="panel history-panel">
                {historyLoading ? (
                  <p>Loading historical observations...</p>
                ) : historyError ? (
                  <p>{historyError}</p>
                ) : chartData.length === 0 ? (
                  <p>No historical measurements available for this station.</p>
                ) : (
                  <>
                    <div className="history-summary">
                      <div>
                        <p className="muted">Latest recorded reading</p>
                        <h2>{latestHistory?.value} µg/m³</h2>
                      </div>
                      <div>
                        <p className="muted">Available data points</p>
                        <h2>{currentHistory.length}</h2>
                      </div>
                      <div>
                        <p className="muted">Data Fetch Timestamp</p>
                        <h2>{formatDateTime(fetchTime)}</h2>
                      </div>
                    </div>

                    <div className="history-chart">
                      {chartData.map((item, index) => {
                        const val = Number(item.value);
                        const dateObj = new Date(item.datetime);
                        const hour = isNaN(dateObj.getTime())
                          ? index
                          : dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });

                        return (
                          <div
                            className="chart-column"
                            key={`${item.datetime}-${index}`}
                            title={`${item.value} µg/m³ · Observed at ${hour}h IST (${formatDateTime(item.datetime)}) · Hourly observation snapshot`}
                          >
                            <div
                              className="chart-bar"
                              style={{
                                height: `${Math.max((val / maxValue) * 100, 3)}%`,
                                backgroundColor: currentStation.pinColor || '#00897b'
                              }}
                            />
                            <span>{hour}h</span>
                          </div>
                        );
                      })}
                    </div>

                    <p className="muted chart-note">
                      Each bar represents an authentic hourly observation in Indian Standard Time (IST).
                      Hover over any bar to view the exact mass concentration and timestamp.
                      Official CPCB NAAQS categories evaluate rolling 24-hour averages, not isolated hourly bars.
                    </p>
                  </>
                )}
              </div>
            </section>

            {/* Map and Insights Grid */}
            <section className="section lower-grid">
              <div className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Location Overview</h2>
                    <p>
                      {currentStation.name} · Data Source: OpenAQ ({currentStation.provider})
                      {ambalaDiscovery && currentStation.cityName === 'Ambala' ? ' · 25 km Discovery Verified' : ''}
                    </p>
                  </div>
                </div>

                <div className="map-container">
                  {currentStation.latitude && currentStation.longitude ? (
                    <MapContainer
                      key={`${currentStation.latitude}-${currentStation.longitude}`}
                      center={[currentStation.latitude, currentStation.longitude]}
                      zoom={11}
                      style={{ height: '320px', width: '100%', borderRadius: '12px' }}
                    >
                      <TileLayer
                        attribution='&copy; OpenStreetMap contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />

                      {/* Station Marker */}
                      <Marker
                        position={[currentStation.latitude, currentStation.longitude]}
                        icon={getStationPin(currentStation)}
                      >
                        <Popup>
                          <strong>{currentStation.name}</strong><br />
                          PM2.5: {pm25 ? `${pm25.value} µg/m³` : 'Reading unavailable'}<br />
                          Locality: {currentLoc.locality || currentStation.locality}<br />
                          OpenAQ Provider: {currentStation.provider}<br />
                          Station Network: {currentStation.network}
                        </Popup>
                      </Marker>

                      {/* If Ambala is selected, also show the 25km circle */}
                      {currentStation.cityName === 'Ambala' && (
                        <Circle
                          center={[30.378, 76.776]}
                          radius={25000}
                          pathOptions={{ color: '#00897b', fillColor: '#80cbc4', fillOpacity: 0.15 }}
                        />
                      )}
                    </MapContainer>
                  ) : (
                    <p>Loading monitoring location...</p>
                  )}
                </div>
              </div>

              {/* Insights and Quick Nav */}
              <div className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Air Quality Navigation</h2>
                    <p>Detailed modules & insights for {currentStation.cityName}</p>
                  </div>
                </div>

                <div className="insight" onClick={() => setActiveNav('compare')} style={{ cursor: 'pointer' }}>
                  <span>⇄</span>
                  <div>
                    <h3>Compare {currentStation.cityName} with Other Cities</h3>
                    <p>Side-by-side comparison across all 9 verified Northern Indian cities.</p>
                  </div>
                </div>

                <div className="insight" onClick={() => setActiveNav('alerts')} style={{ cursor: 'pointer' }}>
                  <span>🔔</span>
                  <div>
                    <h3>Smart AQI Alerts ({alertEvaluation.status === ALERT_STATUS.ACTIVE_ALERT ? 'Active Alert' : alertEvaluation.status === ALERT_STATUS.NORMAL ? 'Compliant' : 'Monitoring'})</h3>
                    <p>Automated threshold evaluation against the CPCB NAAQS 24-hour standard (60 µg/m³).</p>
                  </div>
                </div>

                <div className="insight" onClick={() => setActiveNav('trends')} style={{ cursor: 'pointer' }}>
                  <span>◷</span>
                  <div>
                    <h3>Historical Trends & Statistics</h3>
                    <p>Track 24h & 7-day variation, minimums, maximums, and period averages.</p>
                  </div>
                </div>

                <div className="insight" onClick={() => setActiveNav('health')} style={{ cursor: 'pointer' }}>
                  <span>♡</span>
                  <div>
                    <h3>Health Guidance & NAAQS Standards</h3>
                    <p>Evidence-based recommendations for general and sensitive populations.</p>
                  </div>
                </div>

                <div className="insight" onClick={() => setActiveNav('forecast')} style={{ cursor: 'pointer' }}>
                  <span>☼</span>
                  <div>
                    <h3>Forecast Transparency Disclosure</h3>
                    <p>Open-Meteo CAMS atmospheric model forecast for {currentStation.cityName}.</p>
                  </div>
                </div>

                <div className="insight" onClick={() => setActiveNav('leaderboard')} style={{ cursor: 'pointer' }}>
                  <span>🏆</span>
                  <div>
                    <h3>City PM2.5 Leaderboard</h3>
                    <p>Rank supported cities from lowest to highest physical PM2.5 concentration (not AQI).</p>
                  </div>
                </div>

                <div className="insight" onClick={() => setActiveNav('report')} style={{ cursor: 'pointer' }}>
                  <span>📄</span>
                  <div>
                    <h3>Weekly Air Quality Report</h3>
                    <p>7-day PM2.5 retrospective audit, cleanest/polluted days & printable summary.</p>
                  </div>
                </div>

                <div className="insight" onClick={() => setActiveNav('saved')} style={{ cursor: 'pointer' }}>
                  <span>★</span>
                  <div>
                    <h3>My Saved Locations ({favourites.length})</h3>
                    <p>Quick access to your bookmarked monitoring sites with live status indicators.</p>
                  </div>
                </div>

                <div className="insight" onClick={() => setActiveNav('reliability')} style={{ cursor: 'pointer' }}>
                  <span>📡</span>
                  <div>
                    <h3>Data Reliability & Telemetry</h3>
                    <p>System connectivity, sensor reporting freshness, and cache diagnostics.</p>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {activeNav === 'map' && (
          <MapView
            activeStationId={selectedLocationId}
            nowTimestamp={now}
            onSelectStation={handleStationSelect}
            delhiData={airQualityMap[8118]}
            ambalaData={airQualityMap[6964]}
            stationsAirMap={airQualityMap}
          />
        )}

        {activeNav === 'leaderboard' && (
          <LeaderboardView
            nowTimestamp={now}
            onSelectStation={handleStationSelect}
            onNavigateOverview={() => setActiveNav('overview')}
            initialAirQualityMap={airQualityMap}
            onAirQualityUpdate={handleAirQualityUpdate}
          />
        )}

        {activeNav === 'saved' && (
          <MyLocationsView
            favourites={favourites}
            onUpdateFavourites={handleUpdateFavourites}
            currentStation={currentStation}
            airQualityMap={airQualityMap}
            nowTimestamp={now}
            onSelectStation={handleStationSelect}
            onNavigateOverview={() => setActiveNav('overview')}
          />
        )}

        {activeNav === 'trends' && (
          <TrendsView
            activeStationId={selectedLocationId}
            nowTimestamp={now}
            onStationChange={handleStationSelect}
          />
        )}

        {activeNav === 'report' && (
          <WeeklyReportView
            currentStation={currentStation}
            currentHistory={currentHistory}
            loading={historyLoading}
            error={historyError}
            nowTimestamp={now}
            onRefreshHistory={() => {
              if (currentStation.pm25SensorId) {
                fetchHistory(currentStation.pm25SensorId, true);
              }
            }}
          />
        )}

        {activeNav === 'compare' && (
          <CompareView
            nowTimestamp={now}
            activeStationId={selectedLocationId}
/>
        )}

        {activeNav === 'alerts' && (
          <AlertsView
            currentStation={currentStation}
            stats24h={stats24h}
            latestObservationTime={measurementTime}
            nowTimestamp={now}
            alertEvaluation={alertEvaluation}
            alertHistory={alertHistory}
            onDismissAlert={handleDismissAlert}
            onClearHistory={handleClearAlertHistory}
            onSelectStation={handleStationSelect}
          />
        )}

        {activeNav === 'health' && (
          <HealthView
            currentPm25={pm25 ? pm25.value : null}
            stats24h={stats24h}
            stationName={currentStation.name}
            cityName={currentStation.cityName}
            isCurrentPm25Stale={isStale}
            latestObservationTime={measurementTime}
            nowTimestamp={now}
          />
        )}

        {activeNav === 'forecast' && (
          <ForecastView
            latitude={currentStation.latitude}
            longitude={currentStation.longitude}
            stationName={currentStation.name}
            cityName={currentStation.cityName}
          />
        )}

        {activeNav === 'reliability' && (
          <ReliabilityView
            currentStation={currentStation}
            currentAir={currentAir}
            locationMeta={currentLoc}
            currentHistory={currentHistory}
            nowTimestamp={now}
            activeError={error || historyError}
          />
        )}

        {/* Global Footer */}
        <footer>
          <div className="footer-content">
            <p><strong>BreatheWise</strong> · Verified observations. Model-based forecasts. Clear scientific insights.</p>
            <p>Observational data powered by OpenAQ v3. Air quality forecasts powered by Open-Meteo.</p>
            <p className="footer-disclaimer">
              Scientific Notice: PM2.5 concentration in µg/m³ measures particulate mass density.
              It is distinct from the composite Air Quality Index (AQI), which is calculated via official non-linear breakpoint equations.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
