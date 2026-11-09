// PM2.5 Concentration Standards based on Indian CPCB NAAQS (24-hour standard)
// Note: PM2.5 concentration in µg/m³ is distinct from the multi-pollutant Air Quality Index (AQI).
// Regulatory CPCB NAAQS breakpoints apply to a 24-HOUR AVERAGE, not a single instantaneous reading.

export const PM25_LEVELS = [
  {
    max: 30,
    label: 'Good',
    color: '#2e7d32',
    bgColor: '#e8f5e9',
    borderColor: '#a5d6a7',
    summary: '24-hour mean concentration meets clean air objectives (0–30 µg/m³). Little or no health risk.',
    generalAdvice: 'Ideal condition for outdoor activities, morning walks, and sports.',
    sensitiveAdvice: 'Safe for all groups. No special precautions required.',
    whoComparison: 'Within or near WHO 24h guideline (15 µg/m³).'
  },
  {
    max: 60,
    label: 'Satisfactory',
    color: '#558b2f',
    bgColor: '#f1f8e9',
    borderColor: '#c5e1a5',
    summary: '24-hour mean concentration (31–60 µg/m³) complies with Indian NAAQS 24-hr standard (60 µg/m³).',
    generalAdvice: 'Normal outdoor activities are acceptable.',
    sensitiveAdvice: 'Unusually sensitive individuals should consider taking breaks during intense outdoor exercise.',
    whoComparison: 'Exceeds WHO 24h guideline (15 µg/m³), but meets Indian NAAQS 24-hr standard.'
  },
  {
    max: 90,
    label: 'Moderate',
    color: '#f57f17',
    bgColor: '#fffde7',
    borderColor: '#fff59d',
    summary: '24-hour mean concentration (61–90 µg/m³) exceeds Indian 24-hr standard. Breathing discomfort for sensitive individuals.',
    generalAdvice: 'Reduce strenuous outdoor exertion if experiencing throat irritation or coughing.',
    sensitiveAdvice: 'Children, older adults, and individuals with respiratory issues should limit prolonged outdoor exertion.',
    whoComparison: 'Exceeds Indian 24-hour standard (60 µg/m³).'
  },
  {
    max: 120,
    label: 'Poor',
    color: '#e65100',
    bgColor: '#fff3e0',
    borderColor: '#ffcc80',
    summary: '24-hour mean concentration (91–120 µg/m³). Breathing discomfort to most people on prolonged exposure.',
    generalAdvice: 'Avoid prolonged vigorous outdoor exertion. Keep indoor ventilation controlled during peak traffic hours.',
    sensitiveAdvice: 'Sensitive groups should avoid prolonged outdoor activities and wear an N95 mask if outdoors.',
    whoComparison: 'High particle concentration. Respiratory protection advised.'
  },
  {
    max: 250,
    label: 'Very Poor',
    color: '#c2185b',
    bgColor: '#fce4ec',
    borderColor: '#f48fb1',
    summary: '24-hour mean concentration (121–250 µg/m³). Significant respiratory illness risk on prolonged exposure.',
    generalAdvice: 'Avoid intense outdoor physical activities. Keep windows closed during stagnant/foggy hours. Run HEPA air cleaners indoors.',
    sensitiveAdvice: 'Children and seniors should remain indoors. Asthmatics must keep reliever medications accessible.',
    whoComparison: 'Critically elevated particulate levels.'
  },
  {
    max: Infinity,
    label: 'Severe',
    color: '#b71c1c',
    bgColor: '#ffebee',
    borderColor: '#ef9a9a',
    summary: '24-hour mean concentration exceeds 250 µg/m³. Severe health effects on entire population.',
    generalAdvice: 'Avoid all outdoor physical activity. Seal living spaces, avoid using combustion sources indoors, and run HEPA purifiers.',
    sensitiveAdvice: 'Everyone should remain indoors. Wear certified N95/FFP2 respirators if stepping outside is unavoidable.',
    whoComparison: 'Emergency level air pollution.'
  }
];

/**
 * Evaluates a 24-HOUR AVERAGE PM2.5 concentration against CPCB NAAQS benchmarks.
 * WARNING: Do not apply directly to single hourly readings.
 */
export function getPM25Category(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return {
      label: 'Unknown',
      color: '#757575',
      bgColor: '#f5f5f5',
      borderColor: '#e0e0e0',
      summary: 'Insufficient data to compute 24-hour concentration category.',
      generalAdvice: 'Data not available.',
      sensitiveAdvice: 'Data not available.',
      whoComparison: 'N/A'
    };
  }

  const num = Number(value);
  for (const level of PM25_LEVELS) {
    if (num <= level.max) {
      return level;
    }
  }
  return PM25_LEVELS[PM25_LEVELS.length - 1];
}

/**
 * Extracts a valid numeric timestamp (epoch milliseconds) from various measurement shapes.
 * Handles nested datetime objects, ISO strings, and OpenAQ period formats.
 */
export function parseMeasurementTimestamp(item) {
  if (!item) return null;
  if (typeof item === 'number' && Number.isFinite(item)) return item;

  const raw = item.utcDatetime ||
    (typeof item.datetime === 'object' && item.datetime !== null
      ? (item.datetime.utc || item.datetime.local)
      : item.datetime) ||
    item.period?.datetimeFrom?.utc ||
    item.period?.datetimeFrom?.local ||
    item.period?.datetimeTo?.utc ||
    item.period?.datetimeTo?.local ||
    item.timestamp;

  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Advisory helper for single hourly observation snapshots.
 * Provides immediate situational awareness without applying CPCB 24-hour regulatory categories.
 */
export function getSnapshotAdvisory(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return {
      value: null,
      band: 'Unknown',
      label: 'Reading Unavailable',
      color: '#757575',
      bgColor: '#f5f5f5',
      borderColor: '#e0e0e0',
      description: 'Instantaneous PM2.5 reading unavailable.',
      disclaimer: 'Single hourly observation snapshot. Official CPCB NAAQS benchmarks evaluate rolling 24-hour averages, not isolated readings.',
      isRegulatory: false
    };
  }

  const num = Number(value);
  let band = 'Low';
  let label = 'Low Hourly Concentration';
  let color = '#2e7d32';
  let bgColor = '#e8f5e9';
  let borderColor = '#a5d6a7';
  let description = 'Ambient particulate concentration is currently low.';

  if (num > 250) {
    band = 'Severe';
    label = 'Extremely Elevated Hourly Spike';
    color = '#b71c1c';
    bgColor = '#ffebee';
    borderColor = '#ef9a9a';
    description = 'Critical particulate surge. Acute short-term exposure is hazardous.';
  } else if (num > 120) {
    band = 'Very High';
    label = 'Very High Hourly Concentration';
    color = '#c2185b';
    bgColor = '#fce4ec';
    borderColor = '#f48fb1';
    description = 'Substantial particulate spike. Avoid heavy outdoor physical exertion.';
  } else if (num > 90) {
    band = 'High';
    label = 'High Hourly Concentration';
    color = '#e65100';
    bgColor = '#fff3e0';
    borderColor = '#ffcc80';
    description = 'Elevated particulate level during this hour. Sensitive groups should reduce exertion.';
  } else if (num > 60) {
    band = 'Moderate';
    label = 'Moderate Hourly Concentration';
    color = '#f57f17';
    bgColor = '#fffde7';
    borderColor = '#fff59d';
    description = 'Moderate particle density observed. Sensitive individuals may experience mild throat irritation.';
  } else if (num > 30) {
    band = 'Mild';
    label = 'Mild Hourly Concentration';
    color = '#558b2f';
    bgColor = '#f1f8e9';
    borderColor = '#c5e1a5';
    description = 'Typical daytime ambient concentration.';
  }

  return {
    value: num,
    band,
    label,
    color,
    bgColor,
    borderColor,
    description,
    disclaimer: 'Single hourly observation snapshot. Official CPCB NAAQS benchmarks evaluate rolling 24-hour averages, not isolated readings.',
    isRegulatory: false
  };
}

/**
 * Calculates rolling 24-hour statistics and evaluates diurnal data completeness.
 * Does not claim to be an official statutory CPCB daily average.
 * Labels result as "Rolling 24-hour PM2.5 average" and explains coverage.
 * Verifies that observations are reasonably distributed across the 24-hour window:
 *  - Representative: >=16 valid observations, >=16 distinct hours, span >=18h, >=3 of 4 quadrants covered
 *  - Provisional: Partial distribution (e.g. >=6 observations spanning >=8h across >=2 quadrants)
 *  - Insufficient: Clustered readings or <6 observations -> category unavailable
 */
export function calculate24HourStats(measurements = [], nowTimestamp = Date.now()) {
  if (!Array.isArray(measurements) || measurements.length === 0) {
    return {
      hasData: false,
      average: null,
      count: 0,
      distinctHours: 0,
      spanHours: 0,
      quadrantsCovered: 0,
      coverageQuality: 'insufficient',
      statusLabel: 'Category Unavailable',
      statusDescription: 'No historical measurements available to compute a 24-hour average.',
      category: getPM25Category(null),
      min: null,
      max: null,
      windowPeriod: 'Past 24 Hours'
    };
  }

  const windowStart = nowTimestamp - (24 * 60 * 60 * 1000);
  const windowEnd = nowTimestamp + (5 * 60 * 1000); // 5-minute clock drift tolerance

  const valid24h = measurements
    .map(m => {
      const t = parseMeasurementTimestamp(m);
      const val = m && m.value !== null && m.value !== undefined ? Number(m.value) : null;
      return { raw: m, time: t, value: val };
    })
    .filter(m => m.time !== null && m.time >= windowStart && m.time <= windowEnd && Number.isFinite(m.value));

  const count = valid24h.length;
  if (count === 0) {
    return {
      hasData: false,
      average: null,
      count: 0,
      distinctHours: 0,
      spanHours: 0,
      quadrantsCovered: 0,
      coverageQuality: 'insufficient',
      statusLabel: 'Category Unavailable',
      statusDescription: 'No valid measurements recorded within the past 24-hour window.',
      category: getPM25Category(null),
      min: null,
      max: null,
      windowPeriod: 'Past 24 Hours'
    };
  }

  const values = valid24h.map(m => m.value);
  const timestamps = valid24h.map(m => m.time);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const avg = parseFloat((sum / count).toFixed(1));
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Temporal distribution evaluation across 4 diurnal quadrants (6h blocks)
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const spanHours = parseFloat(((maxTime - minTime) / 3600000).toFixed(1));

  const qSize = 6 * 3600000;
  const quadrants = new Set();
  const hourBuckets = new Set();

  for (const t of timestamps) {
    const offset = Math.max(0, t - windowStart);
    const qIndex = Math.min(3, Math.floor(offset / qSize));
    quadrants.add(qIndex);
    const hourIndex = Math.min(23, Math.floor(offset / 3600000));
    hourBuckets.add(hourIndex);
  }

  const quadrantsCovered = quadrants.size;
  const distinctHours = hourBuckets.size;

  let coverageQuality;
  let statusLabel;
  let statusDescription;
  let category;

  // Criteria 1: Representative (Well-distributed across the full 24h diurnal window)
  if (count >= 16 && distinctHours >= 16 && spanHours >= 18 && quadrantsCovered >= 3) {
    coverageQuality = 'representative';
    statusLabel = 'Rolling 24-hour PM2.5 average';
    statusDescription = `Representative rolling average based on ${count} observations across ${distinctHours} distinct hours (spanning ${spanHours}h across ${quadrantsCovered}/4 diurnal quadrants).`;
    category = getPM25Category(avg);
  }
  // Criteria 2: Provisional (Partial 24h coverage with reasonable spread)
  else if (count >= 6 && spanHours >= 8 && quadrantsCovered >= 2) {
    coverageQuality = 'provisional';
    statusLabel = 'Provisional Rolling Average (Partial Coverage)';
    statusDescription = `Calculated from ${count} observation(s) spanning ${spanHours}h across ${distinctHours} distinct hours (${quadrantsCovered}/4 diurnal quadrants). Does not meet representative 24h distribution criteria; category is provisional.`;
    category = getPM25Category(avg);
  }
  // Criteria 3: Insufficient (Too few observations or clustered readings)
  else {
    coverageQuality = 'insufficient';
    statusLabel = 'Category Unavailable';
    statusDescription = count < 6
      ? `Only ${count} observation(s) in past 24h. CPCB NAAQS benchmarks require representative 24h data to assign a category.`
      : `Observations are clustered in a narrow ${spanHours}h window (${quadrantsCovered}/4 diurnal quadrants). Representative 24-hour distribution is required to assign a rolling category.`;
    category = getPM25Category(null);
  }

  return {
    hasData: true,
    average: avg,
    count,
    distinctHours,
    spanHours,
    quadrantsCovered,
    coverageQuality,
    statusLabel,
    statusDescription,
    category,
    min,
    max,
    windowPeriod: 'Past 24 Hours'
  };
}

export function formatDateTime(isoString) {
  if (!isoString) return 'Not available';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) + ' IST';
  } catch {
    return String(isoString);
  }
}

export function getTimeAgo(isoString, nowTimestamp) {
  if (!isoString) return null;
  try {
    const time = new Date(isoString).getTime();
    if (isNaN(time)) return null;
    const diffMs = nowTimestamp - time;
    if (diffMs < 0) return 'Just now';
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ${mins % 60}m ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h ago`;
  } catch {
    return null;
  }
}
