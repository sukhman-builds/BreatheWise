import { PM25_LEVELS, getSnapshotAdvisory } from '../utils/pm25Standards';

export default function HealthView({ currentPm25, stats24h, stationName }) {
  const has24h = stats24h && stats24h.hasData && stats24h.coverageQuality !== 'insufficient';
  const activeCategory = has24h ? stats24h.category : null;
  const snapshot = getSnapshotAdvisory(currentPm25);

  return (
    <div className="health-view">
      <div className="section-heading">
        <div>
          <h2>Evidence-Based Health & Safety Guidance</h2>
          <p>Scientific recommendations based on ambient PM2.5 concentration standards (CPCB NAAQS & WHO)</p>
        </div>
      </div>

      {/* Primary Regulatory Band Callout - Based strictly on Rolling 24h Average */}
      <div
        className="health-status-banner"
        style={{
          backgroundColor: has24h ? activeCategory.bgColor : '#f5f5f5',
          borderColor: has24h ? activeCategory.borderColor : '#e0e0e0',
          color: has24h ? activeCategory.color : '#616161'
        }}
      >
        <div className="health-status-left">
          <span className="health-eyebrow">
            ROLLING 24-HOUR EXPOSURE LEVEL · {stationName || 'SELECTED STATION'}
          </span>
          <h3>
            {has24h
              ? `${activeCategory.label} — ${stats24h.statusLabel}`
              : 'Rolling 24-Hour Category Unavailable'}
          </h3>
          <p className="health-summary-text">
            {has24h
              ? activeCategory.summary
              : (stats24h?.statusDescription || 'Insufficient historical measurements across the rolling 24-hour window to assign a regulatory CPCB NAAQS category.')}
          </p>
          {has24h && (
            <p className="coverage-subnote" style={{ fontSize: '11px', marginTop: '6px', opacity: 0.9 }}>
              ℹ {stats24h.statusDescription}
            </p>
          )}
          <p className="category-aqi-clarification">
            * Regulatory benchmarks are based on CPCB NAAQS 24-hr PM2.5 mass concentration brackets (µg/m³), distinct from the composite Air Quality Index (AQI).
          </p>
        </div>

        <div className="health-status-value-box">
          <span className="health-val-num">
            {has24h && stats24h.average !== null ? stats24h.average : '—'}
          </span>
          <span className="health-val-unit">µg/m³ (24h Avg)</span>
          <small className="health-val-note">
            {has24h ? activeCategory.whoComparison : 'Coverage Insufficient'}
          </small>
        </div>
      </div>

      {/* Segregated Latest Hourly Snapshot Callout */}
      <div
        className="panel snapshot-advisory-panel"
        style={{
          borderLeft: `4px solid ${snapshot.color}`,
          background: '#ffffff',
          borderRadius: '12px',
          padding: '18px 22px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '1px', color: '#7a8e80', textTransform: 'uppercase' }}>
              IMMEDIATE SITUATIONAL AWARENESS · LATEST HOURLY SNAPSHOT
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#1e3a2b' }}>
                Instantaneous PM2.5: <strong>{currentPm25 !== null ? currentPm25 : '—'} µg/m³</strong>
              </h3>
              <span
                className="category-pill"
                style={{
                  backgroundColor: snapshot.bgColor,
                  color: snapshot.color,
                  borderColor: snapshot.borderColor,
                  fontSize: '11px',
                  padding: '3px 10px'
                }}
              >
                {snapshot.label}
              </span>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#4a6352' }}>
              {snapshot.description}
            </p>
          </div>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: '11px', color: '#7a8e80', fontStyle: 'italic', borderTop: '1px solid #edf2eb', paddingTop: '8px' }}>
          * Notice: {snapshot.disclaimer} Single hourly readings inform immediate outdoor actions (such as postponing strenuous cardio during a spike), but statutory health brackets require rolling 24-hour averages.
        </p>
      </div>

      {/* Practical Action Guides Grid */}
      <div className="health-actions-grid">
        {/* General Public */}
        <div className="panel action-card">
          <div className="action-card-header">
            <span className="action-icon">🏃</span>
            <div>
              <h3>General Population</h3>
              <p className="muted">Adults and active individuals</p>
            </div>
          </div>
          <div className="action-body">
            <p className="primary-advice">
              {has24h
                ? activeCategory.generalAdvice
                : 'Maintain normal precautions. Representative 24-hour rolling category is pending sufficient observation history.'}
            </p>
            <ul className="guidance-list">
              <li><strong>Outdoor Exercise:</strong> Schedule runs and high-intensity workouts during hours with higher solar radiation and lower stagnation (usually midday rather than early dawn).</li>
              <li><strong>Ventilation:</strong> Ventilate home living spaces during afternoon hours when ambient particulate dispersal is typically optimal.</li>
              <li><strong>Commuting:</strong> Keep vehicle windows closed with cabin air recirculation enabled when idling in congested corridors.</li>
            </ul>
          </div>
        </div>

        {/* Sensitive Groups */}
        <div className="panel action-card">
          <div className="action-card-header">
            <span className="action-icon">🩺</span>
            <div>
              <h3>Sensitive & Vulnerable Groups</h3>
              <p className="muted">Children, seniors, asthmatic and cardiac patients</p>
            </div>
          </div>
          <div className="action-body">
            <p className="primary-advice">
              {has24h
                ? activeCategory.sensitiveAdvice
                : 'Sensitive individuals should monitor current symptoms and limit prolonged outdoor exertion if ambient air is visibly hazy.'}
            </p>
            <ul className="guidance-list">
              <li><strong>Respiratory Precautions:</strong> Individuals with asthma or COPD should carry rescue inhalers and keep preventive medications on schedule.</li>
              <li><strong>School & Play:</strong> Minimize strenuous outdoor sports for children when PM2.5 concentrations exceed 90 µg/m³.</li>
              <li><strong>Symptom Monitoring:</strong> Watch for persistent coughing, chest tightness, wheezing, or eye stinging.</li>
            </ul>
          </div>
        </div>

        {/* Protective Measures */}
        <div className="panel action-card">
          <div className="action-card-header">
            <span className="action-icon">🛡</span>
            <div>
              <h3>Personal Protective Interventions</h3>
              <p className="muted">Physical barrier and filtration measures</p>
            </div>
          </div>
          <div className="action-body">
            <ul className="guidance-list">
              <li><strong>N95 / FFP2 Respirators:</strong> Cloth or surgical masks do not adequately filter microscopic PM2.5 particles (&lt;2.5 micrometers). Use certified N95, KN95, or FFP2 respirators with an airtight facial seal when particulate levels are Poor or above.</li>
              <li><strong>HEPA Filtration:</strong> Run True HEPA (High-Efficiency Particulate Air) cleaners in sleeping rooms. Ensure clean air delivery rate (CADR) matches the room volume.</li>
              <li><strong>Combustion Avoidance:</strong> Avoid burning biomass, incense sticks, kerosene heaters, or smoking indoors, as these create extreme micro-environment PM2.5 spikes.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Complete Standards Reference Table */}
      <div className="panel standards-table-panel">
        <div className="section-heading">
          <div>
            <h3>Indian National Ambient Air Quality Standards (NAAQS) — 24-Hour PM2.5 Reference</h3>
            <p>Official 24-hour PM2.5 concentration brackets published by the Central Pollution Control Board (CPCB)</p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="standards-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>24-hr Concentration Range</th>
                <th>Health Impact Overview</th>
                <th>WHO Comparison</th>
              </tr>
            </thead>
            <tbody>
              {PM25_LEVELS.map(lvl => (
                <tr key={lvl.label}>
                  <td>
                    <span
                      className="category-badge"
                      style={{ backgroundColor: lvl.bgColor, color: lvl.color, borderColor: lvl.borderColor }}
                    >
                      {lvl.label}
                    </span>
                  </td>
                  <td><strong>{lvl.max === Infinity ? '> 250' : lvl.max === 30 ? '0 – 30' : lvl.max === 60 ? '31 – 60' : lvl.max === 90 ? '61 – 90' : lvl.max === 120 ? '91 – 120' : '121 – 250'} µg/m³</strong></td>
                  <td>{lvl.summary}</td>
                  <td><small className="muted">{lvl.whoComparison}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Strict Medical Disclaimer */}
      <div className="disclaimer-banner">
        <span className="disclaimer-icon">⚖</span>
        <div>
          <strong>Regulatory & Medical Disclaimer:</strong>
          <p>
            Health recommendations presented in BreatheWise are compiled from published public health literature,
            CPCB NAAQS standards, and WHO ambient air quality guidelines.
            PM2.5 mass concentration is a physical measure and does not constitute medical advice or clinical diagnosis.
            Individuals with chronic cardiovascular or respiratory illnesses should consult their treating physician.
            Always obey statutory public health advisories and emergency measures enacted by regional authorities.
          </p>
        </div>
      </div>
    </div>
  );
}
