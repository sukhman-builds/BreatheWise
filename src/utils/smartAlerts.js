/**
 * Smart AQI Alerts Engine for BreatheWise
 *
 * Implements rigorous, evidence-based particulate threshold evaluation based strictly on
 * Indian CPCB National Ambient Air Quality Standards (NAAQS) 24-hour benchmark (60 µg/m³).
 *
 * Scientific Invariants:
 * 1. Alerts are triggered ONLY when representative rolling 24-hour PM2.5 average > 60 µg/m³.
 * 2. Never generates alerts from missing, stale (>3h), incomplete, or non-representative data.
 * 3. Never confuses single hourly snapshots with regulatory 24-hour averages.
 * 4. Deduplicates alert events by station and observation timestamp.
 */

import { getTimeAgo } from './pm25Standards.js';

export const CPCB_24H_THRESHOLD = 60; // 60 µg/m³ 24-hour statutory standard

export const ALERT_STATUS = {
  ACTIVE_ALERT: 'ACTIVE_ALERT',
  NORMAL: 'NORMAL',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
  STALE_DATA: 'STALE_DATA',
  API_UNAVAILABLE: 'API_UNAVAILABLE'
};

/**
 * Determines severity tier for a rolling 24h average above 60 µg/m³
 */
export function getAlertSeverity(average) {
  if (average > 250) {
    return {
      tier: 'severe',
      label: 'Severe Particulate Alert',
      levelName: 'Severe',
      color: '#b71c1c',
      bgColor: '#ffebee',
      borderColor: '#ef9a9a',
      badgeColor: '#b71c1c',
      urgency: 'Critical',
      actionHeading: 'Emergency Respiratory Protection'
    };
  }
  if (average > 120) {
    return {
      tier: 'very_poor',
      label: 'Very Poor Particulate Advisory',
      levelName: 'Very Poor',
      color: '#c2185b',
      bgColor: '#fce4ec',
      borderColor: '#f48fb1',
      badgeColor: '#c2185b',
      urgency: 'High',
      actionHeading: 'Significant Exposure Advisory'
    };
  }
  if (average > 90) {
    return {
      tier: 'poor',
      label: 'Poor Particulate Advisory',
      levelName: 'Poor',
      color: '#e65100',
      bgColor: '#fff3e0',
      borderColor: '#ffcc80',
      badgeColor: '#e65100',
      urgency: 'Moderate-High',
      actionHeading: 'Outdoor Activity Limitation'
    };
  }
  // 61 to 90
  return {
    tier: 'moderate',
    label: 'Moderate Particulate Advisory',
    levelName: 'Moderate',
    color: '#f57f17',
    bgColor: '#fffde7',
    borderColor: '#fff59d',
    badgeColor: '#f57f17',
    urgency: 'Advisory',
    actionHeading: 'Sensitive Individuals Caution'
  };
}

/**
 * Evaluates the air quality status of a station and determines whether a smart alert is warranted.
 * Strictly enforces that non-representative, missing, or stale data NEVER triggers alerts.
 */
export function evaluateStationAlert({
  station,
  stats24h,
  isStale = false,
  latestObservationTime = null,
  nowTimestamp = Date.now(),
  loading = false,
  apiError = null
}) {
  if (!station) {
    return {
      status: ALERT_STATUS.API_UNAVAILABLE,
      hasAlert: false,
      alert: null,
      diagnostic: {
        title: 'Station Unspecified',
        message: 'No monitoring station is currently selected.',
        details: 'Select a verified monitoring site from the navigation dropdown.',
        badgeColor: '#757575'
      }
    };
  }

  // 1. Check Sensor Availability & API Health
  if (!station.pm25SensorId) {
    return {
      status: ALERT_STATUS.API_UNAVAILABLE,
      hasAlert: false,
      alert: null,
      diagnostic: {
        title: 'Sensor Not Reported',
        message: `Monitoring station "${station.name}" does not report an active PM2.5 sensor.`,
        details: 'OpenAQ station catalog does not report a ground-level PM2.5 monitor at this location.',
        badgeColor: '#757575'
      }
    };
  }

  if (apiError && (!stats24h || !stats24h.hasData)) {
    return {
      status: ALERT_STATUS.API_UNAVAILABLE,
      hasAlert: false,
      alert: null,
      diagnostic: {
        title: 'API Unavailable',
        message: 'Unable to communicate with OpenAQ proxy service.',
        details: String(apiError),
        badgeColor: '#c62828'
      }
    };
  }

  if (loading && (!stats24h || !stats24h.hasData)) {
    return {
      status: ALERT_STATUS.INSUFFICIENT_DATA,
      hasAlert: false,
      alert: null,
      diagnostic: {
        title: 'Synchronizing Sensor History...',
        message: 'Querying chronological observations from ground monitor.',
        details: 'Evaluating 24-hour diurnal coverage.',
        badgeColor: '#0288d1'
      }
    };
  }

  // 2. Check for Stale Data (> 3 hours old)
  if (isStale) {
    const timeAgoStr = latestObservationTime
      ? getTimeAgo(latestObservationTime, nowTimestamp)
      : 'over 3 hours ago';

    return {
      status: ALERT_STATUS.STALE_DATA,
      hasAlert: false,
      alert: null,
      diagnostic: {
        title: 'Data Stale (> 3 Hours)',
        message: `Latest sensor reading was recorded ${timeAgoStr}.`,
        details: 'Alert generation is suspended when observations are stale to prevent outdated notifications.',
        badgeColor: '#b26a00'
      }
    };
  }

  // 3. Check for Representative Temporal Coverage
  // Regulatory NAAQS evaluation requires representative 24h coverage
  if (!stats24h || !stats24h.hasData || stats24h.coverageQuality !== 'representative') {
    const coverageDetail = stats24h?.statusDescription || 'No valid observations recorded within the past 24 hours.';

    return {
      status: ALERT_STATUS.INSUFFICIENT_DATA,
      hasAlert: false,
      alert: null,
      diagnostic: {
        title: 'Incomplete 24-Hour Coverage',
        message: 'Insufficient diurnal spread to calculate a compliant 24-hour average.',
        details: coverageDetail,
        badgeColor: '#5c6bc0'
      }
    };
  }

  // 4. Threshold Evaluation: Representative Rolling 24-Hour Average
  const average = stats24h.average;
  const threshold = CPCB_24H_THRESHOLD;

  if (average > threshold) {
    const excess = parseFloat((average - threshold).toFixed(1));
    const severity = getAlertSeverity(average);
    const observationTimestamp = latestObservationTime || stats24h.windowPeriod;
    const alertId = `alert-${station.id}-${severity.tier}-${new Date(observationTimestamp).getTime() || average}`;

    const alert = {
      id: alertId,
      stationId: station.id,
      stationName: station.name,
      shortName: station.shortName || station.name,
      cityName: station.cityName,
      locality: station.locality,
      provider: station.provider,
      network: station.network,
      sensorId: station.pm25SensorId,
      measuredValue: average,
      threshold,
      excessValue: excess,
      severity,
      observationsCount: stats24h.count,
      distinctHours: stats24h.distinctHours,
      spanHours: stats24h.spanHours,
      quadrantsCovered: stats24h.quadrantsCovered,
      latestObservationTime: observationTimestamp,
      triggeredAt: nowTimestamp,
      reason: `Representative rolling 24-hour PM2.5 average of ${average} µg/m³ exceeds the Indian National Ambient Air Quality Standard (NAAQS) benchmark of 60 µg/m³ by +${excess} µg/m³ across ${stats24h.count} observations (${stats24h.distinctHours} distinct hours).`,
      isDismissed: false
    };

    return {
      status: ALERT_STATUS.ACTIVE_ALERT,
      hasAlert: true,
      alert,
      diagnostic: {
        title: `${severity.levelName} Particulate Alert Active`,
        message: `Rolling 24-hour average is ${average} µg/m³ (exceeds ${threshold} µg/m³ standard).`,
        details: alert.reason,
        badgeColor: severity.color
      }
    };
  }

  // 5. Normal Status: Within Compliant Standard (≤ 60 µg/m³)
  const margin = parseFloat((threshold - average).toFixed(1));
  const categoryLabel = stats24h.category?.label || (average <= 30 ? 'Good' : 'Satisfactory');

  return {
    status: ALERT_STATUS.NORMAL,
    hasAlert: false,
    alert: null,
    diagnostic: {
      title: 'Air Quality Within Standard',
      message: `Representative rolling 24-hour average of ${average} µg/m³ complies with the CPCB 24-hour standard (${threshold} µg/m³).`,
      details: `Current exposure is ${margin} µg/m³ below the statutory 24-hour threshold (${categoryLabel} bracket).`,
      badgeColor: '#2e7d32'
    }
  };
}

/**
 * Deduplicates and records a new alert in an alert history array.
 * If an alert for the same station and event already exists, it is not duplicated.
 */
export function recordAlertEvent(historyList = [], newAlert) {
  if (!newAlert || !newAlert.id) return historyList;

  // Check if identical alert event fingerprint already exists
  const exists = historyList.some(item => item.id === newAlert.id);
  if (exists) {
    return historyList;
  }

  // Prepend new alert to maintain reverse-chronological order
  return [newAlert, ...historyList].slice(0, 50); // Keep max 50 items
}

/**
 * Marks an alert as dismissed by ID
 */
export function dismissAlertById(historyList = [], alertId) {
  return historyList.map(item => {
    if (item.id === alertId) {
      return { ...item, isDismissed: true, dismissedAt: Date.now() };
    }
    return item;
  });
}
