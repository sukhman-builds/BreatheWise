/**
 * Weekly Air Quality Report Engine for BreatheWise
 *
 * Generates audit-grade 7-day particulate exposure reports from authentic ground observations.
 * Identifies cleanest and most polluted days, calculates weekly averages, and formats
 * printable summaries without inventing or extrapolating missing days.
 *
 * CPCB NAAQS Compliance Protocol:
 * Statutory 24-hour PM2.5 evaluation requires defensible data completeness:
 * at least 16 hourly observations out of 24 (67% diurnal completeness). Days with
 * fewer than 16 hours of monitoring are strictly classified as "Insufficient Data",
 * NEVER marked compliant or non-compliant, and never filled with synthetic data.
 */

import { getPM25Category, parseMeasurementTimestamp, formatDateTime } from './pm25Standards.js';

export const CPCB_DAILY_STANDARD = 60; // 60 µg/m³ 24h NAAQS benchmark
export const MIN_HOURS_FOR_24H_COMPLIANCE = 16; // Minimum 16 hours required for CPCB 24h evaluation

/**
 * Generates a comprehensive weekly air quality report for a monitoring site.
 *
 * @param {Array} measurements Array of historical measurements { value, datetime }
 * @param {Object} station Monitoring station configuration
 * @param {number} [nowTimestamp] Current timestamp in ms (default Date.now())
 * @returns {Object} Structured weekly report
 */
export function generateWeeklyReport(measurements = [], station = {}, nowTimestamp = Date.now()) {
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const startWindow = nowTimestamp - sevenDaysMs;

  // Filter valid measurements within past 7 days
  const validMeasurements = (Array.isArray(measurements) ? measurements : [])
    .map(m => {
      const time = parseMeasurementTimestamp(m);
      const val = m && m.value !== null && m.value !== undefined ? Number(m.value) : null;
      return { time, value: val, raw: m };
    })
    .filter(m => m.time !== null && m.time >= startWindow && m.time <= nowTimestamp && Number.isFinite(m.value));

  // Build the 7 calendar days sequence (from oldest to today in IST)
  const daysList = [];
  const dayBuckets = new Map();

  for (let offset = 6; offset >= 0; offset--) {
    const dayEpoch = nowTimestamp - offset * 24 * 60 * 60 * 1000;
    const dateObj = new Date(dayEpoch);

    // Format calendar date key in Asia/Kolkata timezone: YYYY-MM-DD
    const dateKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(dateObj);

    const dayName = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }).format(dateObj);

    daysList.push({ dateKey, dayName, dateObj });
    dayBuckets.set(dateKey, []);
  }

  // Populate day buckets with measurement items
  for (const m of validMeasurements) {
    const d = new Date(m.time);
    const dateKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);

    if (dayBuckets.has(dateKey)) {
      dayBuckets.get(dateKey).push(m);
    }
  }

  // Aggregate daily statistics with defensible CPCB coverage evaluation
  const dailyBreakdown = daysList.map(({ dateKey, dayName, dateObj }) => {
    const items = dayBuckets.get(dateKey) || [];
    const count = items.length;

    if (count === 0) {
      return {
        dateKey,
        dayName,
        dateIso: dateObj.toISOString(),
        hasData: false,
        coverageQuality: 'no_data',
        distinctHours: 0,
        average: null,
        min: null,
        max: null,
        count: 0,
        category: getPM25Category(null),
        isCompliant: null,
        complianceStatus: 'unmonitored',
        complianceLabel: 'No Data',
        note: 'No ground observations recorded'
      };
    }

    // Determine distinct monitoring hours in IST
    const distinctHoursSet = new Set(
      items.map(m => {
        return new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          hour12: false
        }).format(new Date(m.time));
      })
    );
    const distinctHours = distinctHoursSet.size;

    const values = items.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = parseFloat((sum / count).toFixed(1));
    const min = parseFloat(Math.min(...values).toFixed(1));
    const max = parseFloat(Math.max(...values).toFixed(1));

    // Defensible coverage requirement: minimum 16 hours required for CPCB 24h compliance evaluation
    const isSufficient = distinctHours >= MIN_HOURS_FOR_24H_COMPLIANCE;

    if (!isSufficient) {
      return {
        dateKey,
        dayName,
        dateIso: dateObj.toISOString(),
        hasData: true,
        coverageQuality: 'insufficient',
        distinctHours,
        average: avg,
        min,
        max,
        count,
        category: getPM25Category(null), // Cannot assign standard 24h category without diurnal completeness
        isCompliant: null, // STRICT RULE: Must be null; incomplete days are NOT compliant
        complianceStatus: 'insufficient',
        complianceLabel: `Insufficient Data (${distinctHours}h)`,
        note: `${count} reading(s) across ${distinctHours}h — Insufficient for CPCB 24h compliance (requires ≥16h diurnal coverage)`
      };
    }

    const isCompliant = avg <= CPCB_DAILY_STANDARD;

    return {
      dateKey,
      dayName,
      dateIso: dateObj.toISOString(),
      hasData: true,
      coverageQuality: 'sufficient',
      distinctHours,
      average: avg,
      min,
      max,
      count,
      category: getPM25Category(avg),
      isCompliant,
      complianceStatus: isCompliant ? 'compliant' : 'exceeded',
      complianceLabel: isCompliant ? 'Compliant (≤60 µg/m³)' : 'Exceeded (>60 µg/m³)',
      note: `${count} readings across ${distinctHours}h — Complete diurnal coverage`
    };
  });

  // Calculate weekly summaries
  const reportingDays = dailyBreakdown.filter(d => d.hasData);
  const evaluableDays = dailyBreakdown.filter(d => d.coverageQuality === 'sufficient');
  const insufficientDays = dailyBreakdown.filter(d => d.coverageQuality === 'insufficient');
  const totalObservations = validMeasurements.length;

  let cleanestDay = null;
  let mostPollutedDay = null;
  let weeklyAverage = null;
  let compliantDaysCount = 0;
  let exceedanceDaysCount = 0;

  if (reportingDays.length > 0) {
    const sortedByAvg = [...reportingDays].sort((a, b) => a.average - b.average);
    cleanestDay = sortedByAvg[0];
    mostPollutedDay = sortedByAvg[sortedByAvg.length - 1];

    const allValues = validMeasurements.map(m => m.value);
    weeklyAverage = parseFloat((allValues.reduce((a, b) => a + b, 0) / allValues.length).toFixed(1));

    compliantDaysCount = evaluableDays.filter(d => d.isCompliant === true).length;
    exceedanceDaysCount = evaluableDays.filter(d => d.isCompliant === false).length;
  }

  return {
    station: {
      name: station.name || 'Monitoring Site',
      cityName: station.cityName || 'Unknown City',
      locality: station.locality || '',
      provider: station.provider || 'OpenAQ',
      network: station.network || 'CPCB / SPCB',
      sensorId: station.pm25SensorId || null,
      latitude: station.latitude,
      longitude: station.longitude
    },
    generatedAt: formatDateTime(new Date(nowTimestamp).toISOString()),
    windowStart: formatDateTime(new Date(startWindow).toISOString()),
    windowEnd: formatDateTime(new Date(nowTimestamp).toISOString()),
    dailyBreakdown,
    summary: {
      weeklyAverage,
      weeklyCategory: getPM25Category(weeklyAverage),
      totalObservations,
      reportingDaysCount: reportingDays.length,
      evaluableDaysCount: evaluableDays.length,
      insufficientDaysCount: insufficientDays.length,
      totalDays: 7,
      compliantDaysCount,
      exceedanceDaysCount,
      cleanestDay,
      mostPollutedDay,
      hasSufficientData: evaluableDays.length >= 4 && totalObservations >= 30
    },
    regulatoryNotice:
      'Evaluated against Indian Central Pollution Control Board (CPCB) National Ambient Air Quality Standards (NAAQS) 24-hour PM2.5 benchmark (60 µg/m³). In accordance with CPCB protocols, compliance is evaluated only for days with ≥16 hours of monitoring data.'
  };
}
