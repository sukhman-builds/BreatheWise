/**
 * Clean Air Window Analysis Utility
 *
 * Evaluates upcoming hourly atmospheric air quality forecasts to identify the optimal
 * time window for outdoor activities (jogging, cycling, commuting, children's outdoor recreation).
 *
 * Invariants:
 * 1. Strictly labeled as model-based forecast predictions, never guaranteed observations.
 * 2. Never converts null/missing pollutant values into 0.
 * 3. Handles empty, missing, or stale forecast streams gracefully.
 */

import { getPM25Category } from './pm25Standards.js';

export const CLEAN_AIR_DISCLAIMER =
  'Modelled forecast from Open-Meteo atmospheric simulations. Local point-source emissions and microclimate shifts may cause actual ground conditions to vary.';

/**
 * Identifies the cleanest contiguous time window in the upcoming forecast.
 *
 * @param {Array} hourlyForecast Array of { time, pm25, pm10, usAqi }
 * @param {Object} options Configuration options
 * @param {number} [options.nowTimestamp] Current timestamp in ms (defaults to Date.now())
 * @param {number} [options.windowHours=3] Length of window in hours (2 to 4)
 * @param {number} [options.maxLookaheadHours=36] Maximum hours ahead to analyze
 * @returns {Object} Structured clean air window analysis
 */
export function findCleanAirWindow(hourlyForecast = [], options = {}) {
  const {
    nowTimestamp = Date.now(),
    windowHours = 3,
    maxLookaheadHours = 36
  } = options;

  if (!Array.isArray(hourlyForecast) || hourlyForecast.length === 0) {
    return {
      available: false,
      reason: 'Forecast data is currently unavailable for this station.',
      isForecast: true,
      disclaimer: CLEAN_AIR_DISCLAIMER
    };
  }

  // Filter for valid future/current hours within lookahead limit
  const lookaheadLimit = nowTimestamp + maxLookaheadHours * 3600000;
  const futurePoints = hourlyForecast
    .filter(item => {
      if (!item || !item.time) return false;
      const t = new Date(item.time).getTime();
      return Number.isFinite(t) && t >= nowTimestamp - 30 * 60 * 1000 && t <= lookaheadLimit;
    })
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  if (futurePoints.length === 0) {
    return {
      available: false,
      reason: 'No upcoming future forecast hours available.',
      isForecast: true,
      disclaimer: CLEAN_AIR_DISCLAIMER
    };
  }

  const effectiveWindowSize = Math.max(1, Math.min(windowHours, futurePoints.length));
  let bestWindow = null;
  let lowestScore = Infinity;

  // Evaluate sliding windows with full contiguous data
  for (let i = 0; i <= futurePoints.length - effectiveWindowSize; i++) {
    const windowSlice = futurePoints.slice(i, i + effectiveWindowSize);

    // Extract valid PM2.5 readings (strictly finite, not null)
    const validPm25s = windowSlice
      .map(p => (p.pm25 !== null && Number.isFinite(Number(p.pm25)) ? Number(p.pm25) : null))
      .filter(v => v !== null);

    // Extract valid US AQI readings
    const validAqi = windowSlice
      .map(p => (p.usAqi !== null && Number.isFinite(Number(p.usAqi)) ? Number(p.usAqi) : null))
      .filter(v => v !== null);

    // Require all points in the window to be valid numbers for a complete window
    if (validPm25s.length < effectiveWindowSize) {
      continue;
    }

    const meanPm25 = validPm25s.reduce((a, b) => a + b, 0) / validPm25s.length;
    const meanAqi = validAqi.length > 0 ? Math.round(validAqi.reduce((a, b) => a + b, 0) / validAqi.length) : null;

    if (meanPm25 < lowestScore) {
      lowestScore = meanPm25;
      const startTime = windowSlice[0].time;
      const lastPoint = windowSlice[windowSlice.length - 1];
      const endTimeDate = new Date(new Date(lastPoint.time).getTime() + 3600000);

      bestWindow = {
        startTime,
        endTime: endTimeDate.toISOString(),
        slice: windowSlice,
        avgPm25: parseFloat(meanPm25.toFixed(1)),
        avgUsAqi: meanAqi,
        pointsCount: validPm25s.length
      };
    }
  }

  // Fallback to single lowest point if contiguous window wasn't found
  if (!bestWindow) {
    const validSinglePoints = futurePoints
      .filter(p => p.pm25 !== null && Number.isFinite(Number(p.pm25)))
      .map(p => ({
        startTime: p.time,
        endTime: new Date(new Date(p.time).getTime() + 3600000).toISOString(),
        avgPm25: parseFloat(Number(p.pm25).toFixed(1)),
        avgUsAqi: p.usAqi !== null && Number.isFinite(Number(p.usAqi)) ? Number(p.usAqi) : null,
        pointsCount: 1
      }))
      .sort((a, b) => a.avgPm25 - b.avgPm25);

    if (validSinglePoints.length > 0) {
      bestWindow = validSinglePoints[0];
    }
  }

  if (!bestWindow) {
    return {
      available: false,
      reason: 'Forecast values do not contain sufficient particulate data.',
      isForecast: true,
      disclaimer: CLEAN_AIR_DISCLAIMER
    };
  }

  const category = getPM25Category(bestWindow.avgPm25);
  const startObj = new Date(bestWindow.startTime);
  const endObj = new Date(bestWindow.endTime);

  const startFormatted = startObj.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });

  const endFormatted = endObj.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });

  const dayLabel = startObj.toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Kolkata'
  });

  // Recommendation & rationale generator based strictly on available forecast data
  let explanation;
  let recommendation;

  if (bestWindow.avgPm25 <= 30) {
    recommendation = 'Ideal period for outdoor sports, distance running, and prolonged recreation.';
    explanation = `Upcoming forecast indicates this 3-hour period has the lowest predicted particulate concentration (averaging ${bestWindow.avgPm25} µg/m³), remaining well within the clean air objective (0–30 µg/m³).`;
  } else if (bestWindow.avgPm25 <= 60) {
    recommendation = 'Comfortable window for general outdoor activities and light cardio.';
    explanation = `Upcoming forecast indicates this 3-hour period has the lowest predicted particulate concentration (averaging ${bestWindow.avgPm25} µg/m³), complying with the CPCB 24-hour statutory benchmark (60 µg/m³).`;
  } else if (bestWindow.avgPm25 <= 90) {
    recommendation = 'Suitable for necessary errands and moderate walks; avoid high-intensity aerobic cardio.';
    explanation = `Upcoming forecast indicates moderate particulate concentrations (averaging ${bestWindow.avgPm25} µg/m³). This 3-hour window represents the lowest predicted concentration interval compared to surrounding forecast hours.`;
  } else {
    recommendation = 'Limit outdoor exposure; wear a certified N95 respirator if outdoor transit is required.';
    explanation = `Upcoming forecast indicates elevated particulate concentrations across all simulated hours. This 3-hour window represents the relative minimum predicted exposure interval (${bestWindow.avgPm25} µg/m³) in the available forecast horizon.`;
  }

  return {
    available: true,
    dayLabel,
    timeRange: `${startFormatted} – ${endFormatted} IST`,
    startTime: bestWindow.startTime,
    endTime: bestWindow.endTime,
    avgPm25: bestWindow.avgPm25,
    avgUsAqi: bestWindow.avgUsAqi,
    category,
    recommendation,
    explanation,
    isForecast: true,
    disclaimer: CLEAN_AIR_DISCLAIMER
  };
}
