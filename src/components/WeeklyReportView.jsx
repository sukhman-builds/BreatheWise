import { useMemo } from 'react';
import { generateWeeklyReport } from '../utils/weeklyReport.js';

export default function WeeklyReportView({
  currentStation,
  currentHistory = [],
  loading = false,
  error = '',
  nowTimestamp,
  onRefreshHistory
}) {
  const report = useMemo(() => {
    return generateWeeklyReport(currentHistory, currentStation, nowTimestamp);
  }, [currentHistory, currentStation, nowTimestamp]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="weekly-report-view">
      {/* 1. Header (Screen View) */}
      <div className="section-heading no-print">
        <div>
          <h2>Weekly Air Quality Audit Report</h2>
          <p>
            Retrospective 7-day particulate exposure analysis for {currentStation.name} based on authentic ground-monitoring observations.
            CPCB NAAQS 24-hour compliance (60 µg/m³) is evaluated only for days meeting the application-defined data completeness criterion (≥16h/day).
          </p>
        </div>

        <div className="report-action-buttons">
          {onRefreshHistory && (
            <button
              type="button"
              className="btn-refresh"
              onClick={onRefreshHistory}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : '↻ Refresh History'}
            </button>
          )}

          <button
            type="button"
            className="btn-print-report"
            onClick={handlePrint}
          >
            🖨 Print / Export PDF
          </button>
        </div>
      </div>

      {/* 2. Formal Printable Header (Visible in print mode) */}
      <div className="printable-report-header">
        <div className="printable-brand">
          <span className="brand-icon">✳</span>
          <h1>BreatheWise · Weekly Ambient Air Quality Report</h1>
        </div>
        <p className="printable-meta">
          <strong>Station:</strong> {currentStation.name} ({currentStation.cityName}) ·{' '}
          <strong>Provider:</strong> {currentStation.provider} ·{' '}
          <strong>Network:</strong> {currentStation.network} ·{' '}
          <strong>Sensor ID:</strong> #{currentStation.pm25SensorId || 'N/A'}<br />
          <strong>Reporting Window:</strong> {report.windowStart} to {report.windowEnd}<br />
          <strong>Generated:</strong> {report.generatedAt}
        </p>
      </div>

      {loading ? (
        <div className="loading-card no-print">
          <div className="spinner"></div>
          <p>Compiling 7-day chronological observations from OpenAQ sensor #{currentStation.pm25SensorId}...</p>
        </div>
      ) : error ? (
        <div className="error-card no-print">
          <span className="error-icon">⚠</span>
          <div>
            <h3>Weekly Timeline Unavailable</h3>
            <p>{error}</p>
          </div>
        </div>
      ) : currentHistory.length === 0 ? (
        <div className="empty-card no-print">
          <h3>No Historical Observations Recorded</h3>
          <p>
            Ground sensor #{currentStation.pm25SensorId || 'N/A'} does not have published historical measurements in the past 7 days.
          </p>
        </div>
      ) : (
        <>
          {/* 3. Executive Summary Highlights */}
          <div className="weekly-summary-grid">
            {/* Cleanest Day */}
            <div className="summary-stat-card cleanest-stat">
              <span className="stat-card-badge">🌿 CLEANEST DAY OF THE WEEK</span>
              {report.summary.cleanestDay ? (
                <div>
                  <h3 className="stat-day-title">{report.summary.cleanestDay.dayName}</h3>
                  <div className="stat-val-row">
                    <span className="stat-val">{report.summary.cleanestDay.average}</span>
                    <span className="stat-unit">µg/m³ (Day Mean)</span>
                  </div>
                  {report.summary.cleanestDay.coverageQuality === 'sufficient' ? (
                    <span
                      className="category-pill"
                      style={{
                        backgroundColor: report.summary.cleanestDay.category.bgColor,
                        color: report.summary.cleanestDay.category.color,
                        borderColor: report.summary.cleanestDay.category.borderColor,
                        marginTop: '6px'
                      }}
                    >
                      {report.summary.cleanestDay.category.label}
                    </span>
                  ) : (
                    <span className="category-pill-na" style={{ marginTop: '6px' }}>
                      Partial Coverage ({report.summary.cleanestDay.distinctHours}h)
                    </span>
                  )}
                  <p className="stat-desc">
                    Based on {report.summary.cleanestDay.count} valid hourly reading(s). Range: {report.summary.cleanestDay.min} – {report.summary.cleanestDay.max} µg/m³.
                  </p>
                </div>
              ) : (
                <p className="text-muted">Insufficient observations</p>
              )}
            </div>

            {/* Most Polluted Day */}
            <div className="summary-stat-card polluted-stat">
              <span className="stat-card-badge">⚠ HIGHEST EXPOSURE DAY</span>
              {report.summary.mostPollutedDay ? (
                <div>
                  <h3 className="stat-day-title">{report.summary.mostPollutedDay.dayName}</h3>
                  <div className="stat-val-row">
                    <span className="stat-val">{report.summary.mostPollutedDay.average}</span>
                    <span className="stat-unit">µg/m³ (Day Mean)</span>
                  </div>
                  {report.summary.mostPollutedDay.coverageQuality === 'sufficient' ? (
                    <span
                      className="category-pill"
                      style={{
                        backgroundColor: report.summary.mostPollutedDay.category.bgColor,
                        color: report.summary.mostPollutedDay.category.color,
                        borderColor: report.summary.mostPollutedDay.category.borderColor,
                        marginTop: '6px'
                      }}
                    >
                      {report.summary.mostPollutedDay.category.label}
                    </span>
                  ) : (
                    <span className="category-pill-na" style={{ marginTop: '6px' }}>
                      Partial Coverage ({report.summary.mostPollutedDay.distinctHours}h)
                    </span>
                  )}
                  <p className="stat-desc">
                    Based on {report.summary.mostPollutedDay.count} valid hourly reading(s). Peak spike: {report.summary.mostPollutedDay.max} µg/m³.
                  </p>
                </div>
              ) : (
                <p className="text-muted">Insufficient observations</p>
              )}
            </div>

            {/* Weekly Average */}
            <div className="summary-stat-card mean-stat">
              <span className="stat-card-badge">📊 7-DAY COMPOSITE AVERAGE</span>
              <div>
                <h3 className="stat-day-title">Weekly Particulate Mean</h3>
                <div className="stat-val-row">
                  <span className="stat-val">{report.summary.weeklyAverage !== null ? report.summary.weeklyAverage : '—'}</span>
                  <span className="stat-unit">µg/m³</span>
                </div>
                {report.summary.weeklyAverage !== null && (
                  <span
                    className="category-pill"
                    style={{
                      backgroundColor: report.summary.weeklyCategory.bgColor,
                      color: report.summary.weeklyCategory.color,
                      borderColor: report.summary.weeklyCategory.borderColor,
                      marginTop: '6px'
                    }}
                  >
                    {report.summary.weeklyCategory.label}
                  </span>
                )}
                <p className="stat-desc">
                  Aggregate of {report.summary.totalObservations} valid observations across {report.summary.reportingDaysCount} reporting days.
                </p>
              </div>
            </div>

            {/* Statutory Compliance Tally */}
            <div className="summary-stat-card compliance-stat">
              <span className="stat-card-badge">⚖ CPCB NAAQS 24-HR COMPLIANCE</span>
              <div>
                <h3 className="stat-day-title">Evaluable Days Benchmark</h3>
                <div className="stat-val-row">
                  <span className="stat-val">
                    {report.summary.evaluableDaysCount > 0
                      ? `${report.summary.compliantDaysCount} of ${report.summary.evaluableDaysCount}`
                      : '0 of 0'}
                  </span>
                  <span className="stat-unit">Days Compliant</span>
                </div>
                <p className="stat-desc">
                  {report.summary.evaluableDaysCount > 0
                    ? `Days with ≥16h data and mean ≤60 µg/m³. Exceedances: ${report.summary.exceedanceDaysCount}.`
                    : 'No calendar days met the application-defined ≥16h diurnal coverage required for 24-hr evaluation against CPCB standards.'}
                  {report.summary.insufficientDaysCount > 0 && (
                    <span> ({report.summary.insufficientDaysCount} incomplete day(s) labeled Insufficient Data).</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* 4. Day-by-Day Historical Breakdown Table */}
          <div className="panel weekly-table-panel">
            <div className="section-heading">
              <div>
                <h3>Day-by-Day Exposure Log</h3>
                <p>Authentic daily averages computed strictly from chronological hourly ground readings</p>
              </div>
            </div>

            <div className="table-responsive">
              <table className="compare-table weekly-breakdown-table">
                <thead>
                  <tr>
                    <th>Day & Date</th>
                    <th>Observations & Coverage</th>
                    <th>24h Mean (µg/m³)</th>
                    <th>Min – Max Range</th>
                    <th>CPCB NAAQS Category</th>
                    <th>CPCB 24h Status (≤60 µg/m³)</th>
                  </tr>
                </thead>
                <tbody>
                  {report.dailyBreakdown.map((day) => (
                    <tr key={day.dateKey} className={day.hasData ? '' : 'row-no-data'}>
                      <td>
                        <strong>{day.dayName}</strong>
                      </td>
                      <td>
                        {day.hasData ? (
                          <div>
                            <span>{day.count} readings</span>
                            <small style={{ display: 'block', color: day.coverageQuality === 'sufficient' ? '#2e7d32' : '#b26a00' }}>
                              {day.distinctHours}h of 24h ({day.coverageQuality === 'sufficient' ? 'Complete' : 'Incomplete <16h'})
                            </small>
                          </div>
                        ) : (
                          <span className="text-muted">0 readings</span>
                        )}
                      </td>
                      <td>
                        {day.hasData ? (
                          <strong className="table-avg-val">{day.average} µg/m³</strong>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        {day.hasData ? (
                          <span>{day.min} – {day.max} µg/m³</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        {day.hasData ? (
                          day.coverageQuality === 'sufficient' ? (
                            <span
                              className="category-pill"
                              style={{
                                backgroundColor: day.category.bgColor,
                                color: day.category.color,
                                borderColor: day.category.borderColor
                              }}
                            >
                              {day.category.label}
                            </span>
                          ) : (
                            <span className="category-pill-na" title="24-hour category requires ≥16 hours diurnal coverage">
                              Insufficient Data
                            </span>
                          )
                        ) : (
                          <span className="category-pill-na">No Data</span>
                        )}
                      </td>
                      <td>
                        {day.hasData ? (
                          day.complianceStatus === 'compliant' ? (
                            <span className="compliance-tag compliant">✓ Within Standard (≤60)</span>
                          ) : day.complianceStatus === 'exceeded' ? (
                            <span className="compliance-tag exceedance">⚠ Exceeds Standard (&gt;60)</span>
                          ) : (
                            <span className="compliance-tag insufficient" title="Incomplete diurnal coverage (<16h). Cannot verify 24h compliance.">
                              ⏳ Insufficient Data (&lt;16h)
                            </span>
                          )
                        ) : (
                          <span className="text-muted">Unmonitored</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. Regulatory Disclaimer Footer */}
          <div className="panel report-disclaimer-panel">
            <h4>⚖ Scientific Integrity & Regulatory Scope Notice</h4>
            <p>
              {report.regulatoryNotice} Physical particulate mass concentration is compiled from OpenAQ ground observations.
              Missing days are never imputed, interpolated, or replaced with synthetic values. Under BreatheWise application criteria, incomplete days (&lt;16 hours) are labeled Insufficient Data rather than compliant or non-compliant.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
