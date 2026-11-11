/**
 * Weekly Air Quality Report Engine for BreatheWise
 *
 * Generates audit-grade 7-day particulate exposure reports from authentic ground observations.
 * Identifies cleanest and most polluted days, calculates weekly averages, and formats
 * printable summaries without inventing or extrapolating missing days.
 *
 * Application-Defined Data Completeness Protocol:
 * BreatheWise applies an application-defined completeness criterion for credible 24-hour evaluation:
 * at least 16 hourly observations out of 24 (67% diurnal completeness). Days with
 * fewer than 16 hours of monitoring are strictly classified as "Insufficient Data",
 * NEVER marked compliant or non-compliant, and never filled with synthetic data.
 *
 * Aggregation Methodology:
 * 1. Hourly Aggregation: Raw observations are first aggregated by IST calendar hour (0 to 23).
 *    Daily averages are calculated as the unweighted mean of observed hourly averages,
 *    preventing duplicate or high-frequency readings within any single hour from overweighting that hour.
 * 2. Weekly Average: The weekly composite average is calculated as the unweighted arithmetic mean
 *    of all observed hourly averages across the 7-day calendar window.
 * 3. Ranking Integrity: Only days with 'sufficient' coverage (≥16 distinct monitored hours)
 *    are eligible for cleanest and most polluted day rankings. Insufficient days are never ranked.
 * 4. Calendar Window: Constructed from seven consecutive IST calendar dates ending on the current IST date.
 */

import { getPM25Category, parseMeasurementTimestamp, formatDateTime } from './pm25Standards.js';

export const CPCB_DAILY_STANDARD = 60; // 60 µg/m³ 24h NAAQS benchmark
export const MIN_HOURS_FOR_24H_COMPLIANCE = 16; // Application-defined minimum 16 hours required for 24h evaluation
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // Indian Standard Time offset (+05:30)

/**
 * Extracts the IST calendar date key (YYYY-MM-DD) from a millisecond timestamp.
 *
 * @param {number} timestampMs Epoch timestamp in ms
 * @returns {string} YYYY-MM-DD in Asia/Kolkata
 */
export function getISTDateKey(timestampMs) {
  const d = new Date(timestampMs + IST_OFFSET_MS);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Extracts the IST calendar hour (0-23) from a millisecond timestamp.
 *
 * @param {number} timestampMs Epoch timestamp in ms
 * @returns {number} Hour 0 to 23 in Asia/Kolkata
 */
export function getISTHour(timestampMs) {
  return new Date(timestampMs + IST_OFFSET_MS).getUTCHours();
}

/**
 * Generates a comprehensive weekly air quality report for a monitoring site.
 *
 * @param {Array} measurements Array of historical measurements { value, datetime }
 * @param {Object} station Monitoring station configuration
 * @param {number} [nowTimestamp] Current timestamp in ms (default Date.now())
 * @returns {Object} Structured weekly report
 */
export function generateWeeklyReport(measurements = [], station = {}, nowTimestamp = Date.now()) {
  // Derive current IST calendar date components
  const nowIst = new Date(nowTimestamp + IST_OFFSET_MS);
  const curYear = nowIst.getUTCFullYear();
  const curMonth = nowIst.getUTCMonth();
  const curDay = nowIst.getUTCDate();

  // Generate 7 consecutive IST calendar days ending on the current IST date
  // Using UTC date math avoids fixed 24-hour subtraction drift across month/year boundaries
  const daysList = [];
  const dayBuckets = new Map();

  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(Date.UTC(curYear, curMonth, curDay - offset));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const dayNum = d.getUTCDate();

    const dateKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const startOfDayMs = Date.UTC(y, m, dayNum) - IST_OFFSET_MS;
    const dateObj = new Date(startOfDayMs);

    // Midday IST for stable locale formatting
    const midDayIst = new Date(startOfDayMs + 12 * 60 * 60 * 1000);
    const dayName = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }).format(midDayIst);

    daysList.push({ dateKey, dayName, dateObj, startOfDayMs });
    dayBuckets.set(dateKey, []);
  }

  const windowStartMs = daysList[0].startOfDayMs;
  const windowEndMs = nowTimestamp;

  // Filter valid measurements within the 7-day calendar window up to nowTimestamp
  const validMeasurements = (Array.isArray(measurements) ? measurements : [])
    .map(m => {
      const time = parseMeasurementTimestamp(m);
      const val = m && m.value !== null && m.value !== undefined ? Number(m.value) : null;
      return { time, value: val, raw: m };
    })
    .filter(m => m.time !== null && m.time >= windowStartMs && m.time <= windowEndMs && Number.isFinite(m.value));

  // Populate day buckets using IST calendar dates
  for (const m of validMeasurements) {
    const dateKey = getISTDateKey(m.time);
    if (dayBuckets.has(dateKey)) {
      dayBuckets.get(dateKey).push(m);
    }
  }

  // Track all observed hourly averages across the week for composite weekly average
  const allObservedHourlyAverages = [];

  // Aggregate daily statistics with hourly pre-aggregation
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

    // Group items by IST hour (0 to 23) to prevent duplicate readings in one hour from overweighting that hour
    const hourBuckets = new Map();
    for (const m of items) {
      const hour = getISTHour(m.time);
      if (!hourBuckets.has(hour)) {
        hourBuckets.set(hour, []);
      }
      hourBuckets.get(hour).push(m.value);
    }

    const distinctHours = hourBuckets.size;

    // Calculate hourly averages for each monitored hour
    const hourlyAverages = [];
    for (const [, vals] of hourBuckets.entries()) {
      const hSum = vals.reduce((a, b) => a + b, 0);
      const hAvg = hSum / vals.length;
      hourlyAverages.push(hAvg);
      allObservedHourlyAverages.push(hAvg);
    }

    // Daily average is the unweighted mean of observed hourly averages
    const dailyAvgSum = hourlyAverages.reduce((a, b) => a + b, 0);
    const avg = distinctHours > 0 ? parseFloat((dailyAvgSum / distinctHours).toFixed(1)) : null;

    const values = items.map(m => m.value);
    const min = parseFloat(Math.min(...values).toFixed(1));
    const max = parseFloat(Math.max(...values).toFixed(1));

    // Application-defined coverage requirement: minimum 16 hours required for 24h evaluation against CPCB benchmark
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
        note: `${count} reading(s) across ${distinctHours}h — Insufficient diurnal coverage (requires ≥16h application threshold for 24h comparison)`
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

  // Cleanest and most polluted day rankings must include ONLY days with coverageQuality === 'sufficient'
  if (evaluableDays.length > 0) {
    const sortedByAvg = [...evaluableDays].sort((a, b) => a.average - b.average);
    cleanestDay = sortedByAvg[0];
    mostPollutedDay = sortedByAvg[sortedByAvg.length - 1];
  }

  // Weekly average is the unweighted mean of all observed hourly averages across the 7-day calendar window
  if (allObservedHourlyAverages.length > 0) {
    const weeklySum = allObservedHourlyAverages.reduce((a, b) => a + b, 0);
    weeklyAverage = parseFloat((weeklySum / allObservedHourlyAverages.length).toFixed(1));
  }

  if (reportingDays.length > 0) {
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
    windowStart: formatDateTime(new Date(windowStartMs).toISOString()),
    windowEnd: formatDateTime(new Date(windowEndMs).toISOString()),
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
      'Evaluated against Indian Central Pollution Control Board (CPCB) National Ambient Air Quality Standards (NAAQS) 24-hour PM2.5 benchmark (60 µg/m³). Compliance is evaluated only for days meeting the application-defined completeness criterion of ≥16 hours of monitoring data.'
  };
}
