/**
 * City PM2.5 Leaderboard Engine for BreatheWise
 *
 * Ranks all supported verified cities from lowest to highest physical PM2.5 mass
 * concentration (µg/m³). Note: PM2.5 concentration is distinct from composite AQI.
 * Cities with missing or stale observations are explicitly identified and excluded
 * from current live rankings so outdated readings are never misrepresented as current.
 */

import { SUPPORTED_CITIES, getDefaultStationForCity } from '../config/stations.js';
import { getPM25Category, formatDateTime, getTimeAgo } from './pm25Standards.js';

/**
 * Builds an objective, fair PM2.5 leaderboard across all verified Northern Indian cities.
 *
 * @param {Object} airQualityMap Dictionary of stationId -> air quality data payload
 * @param {number} [nowTimestamp] Current timestamp in ms
 * @returns {Object} Structured leaderboard data
 */
export function buildCityLeaderboard(airQualityMap = {}, nowTimestamp = Date.now()) {
  const cityEntries = [];

  for (const cityName of SUPPORTED_CITIES) {
    const station = getDefaultStationForCity(cityName);
    const stationAir = airQualityMap[station.id];
    const readings = stationAir?.readings || [];
    const pm25Reading = readings.find(r => r.pollutant === 'pm25');

    const rawVal = pm25Reading?.value;
    const hasValidValue = rawVal !== null && rawVal !== undefined && Number.isFinite(Number(rawVal));
    const pm25Value = hasValidValue ? parseFloat(Number(rawVal).toFixed(1)) : null;

    const measurementTime = pm25Reading?.datetime?.local || pm25Reading?.datetime?.utc || null;
    const measurementAgeHours = measurementTime
      ? (nowTimestamp - new Date(measurementTime).getTime()) / 3600000
      : null;

    // Stale if marked stale by backend or observation older than 3 hours
    const isStale = Boolean(stationAir?.isStale) || (measurementAgeHours !== null && measurementAgeHours > 3);

    cityEntries.push({
      cityName,
      stationId: station.id,
      stationName: station.shortName || station.name,
      locality: station.locality,
      provider: station.provider,
      pm25: pm25Value,
      unit: pm25Reading?.unit || 'µg/m³',
      hasData: hasValidValue,
      category: getPM25Category(pm25Value),
      measurementTime: measurementTime ? formatDateTime(measurementTime) : 'Not available',
      measurementIso: measurementTime,
      measurementAge: measurementTime ? getTimeAgo(measurementTime, nowTimestamp) : null,
      isStale,
      pinColor: station.pinColor || '#1b5e20'
    });
  }

  // Strictly segment into:
  // 1. Current reporting (valid data & observation within 3 hours)
  // 2. Stale reporting (valid data, but observation > 3 hours old)
  // 3. Unavailable (no sensor reading)
  const currentReporting = cityEntries.filter(c => c.hasData && !c.isStale);
  const staleReporting = cityEntries.filter(c => c.hasData && c.isStale);
  const unavailable = cityEntries.filter(c => !c.hasData);

  // Fair ranking: Lowest PM2.5 (cleanest air) first among CURRENT observations
  currentReporting.sort((a, b) => a.pm25 - b.pm25);

  // Stale and unavailable cities are NEVER assigned ranks in current rankings
  const rankedCities = currentReporting.map((item, index) => ({
    ...item,
    rank: index + 1,
    rankingStatus: 'current',
    rankNote: 'Live verified observation'
  }));

  const staleCities = staleReporting.map(item => ({
    ...item,
    rank: null,
    rankingStatus: 'stale',
    rankNote: 'Stale observation (>3h old) — excluded from current rankings'
  }));

  const unrankedCities = unavailable.map(item => ({
    ...item,
    rank: null,
    rankingStatus: 'unavailable',
    rankNote: 'No ground observations reported'
  }));

  const allCities = [...rankedCities, ...staleCities, ...unrankedCities];

  // Best/worst callouts reflect ONLY current, non-stale observations
  const cleanestCity = rankedCities[0] || null;
  const mostPollutedCity = rankedCities.length > 0 ? rankedCities[rankedCities.length - 1] : null;

  return {
    totalCities: SUPPORTED_CITIES.length,
    currentReportingCount: rankedCities.length,
    staleCount: staleCities.length,
    unavailableCount: unrankedCities.length,
    reportingCount: rankedCities.length, // Alias for backward compatibility
    cities: allCities,
    cleanestCity,
    mostPollutedCity,
    metricDisclaimer: 'Rankings are based on authentic ground-sensor physical PM2.5 mass concentration (µg/m³). Lower values indicate lower particulate density. Stale and offline cities are excluded from current rankings.'
  };
}
