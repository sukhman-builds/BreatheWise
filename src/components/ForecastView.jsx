export default function ForecastView() {
  return (
    <div className="forecast-view">
      <div className="section-heading">
        <div>
          <h2>Air Quality Forecast Status</h2>
          <p>Scientific transparency and data integrity declaration</p>
        </div>
      </div>

      {/* Honest Unavailable State Hero Card */}
      <div className="forecast-hero-card">
        <div className="forecast-hero-icon">☼</div>
        <div className="forecast-hero-content">
          <span className="forecast-status-tag">STATUS: HONEST DISCLOSURE</span>
          <h3>Air Quality Forecast Currently Unavailable</h3>
          <p className="forecast-lead">
            BreatheWise does not show synthetic or simulated future air quality forecasts because
            <strong> no verified, open forecast model is integrated into this data pipeline.</strong>
          </p>
          <p className="forecast-sub">
            Our data provider, <strong>OpenAQ v3</strong>, is an observational global repository that archives
            direct physical measurements reported by government and research ground stations.
            OpenAQ does not generate mathematical predictive forecasts.
          </p>
        </div>
      </div>

      {/* Why We Refuse to Fabricate Forecasts */}
      <div className="panel data-integrity-panel">
        <div className="section-heading">
          <div>
            <h3>Why We Never Fabricate Pollution Predictions</h3>
            <p>Our commitment to rigorous scientific pair-programming standards</p>
          </div>
        </div>

        <div className="integrity-grid">
          <div className="integrity-card">
            <span className="integrity-number">01</span>
            <h4>Physical Safety</h4>
            <p>
              Fabricating a "Good" forecast when severe meteorological stagnation is looming could lead sensitive individuals,
              asthmatics, or outdoor runners to make hazardous exposure decisions.
            </p>
          </div>

          <div className="integrity-card">
            <span className="integrity-number">02</span>
            <h4>Atmospheric Complexity</h4>
            <p>
              True particulate forecasting requires coupled Chemical Transport Models (such as WRF-Chem or GEOS-Chem),
              assimilating real-time boundary layer height, wind trajectories, and satellite aerosol optical depth (AOD).
            </p>
          </div>

          <div className="integrity-card">
            <span className="integrity-number">03</span>
            <h4>Zero Hallucinations</h4>
            <p>
              Many air quality apps display arbitrary algorithmic extrapolations or mock numbers under the guise of "AI Forecasts".
              BreatheWise strictly adheres to authentic observational ground truth.
            </p>
          </div>
        </div>
      </div>

      {/* How Authentic Forecasts Are Modeled */}
      <div className="panel forecast-education-panel">
        <div className="section-heading">
          <div>
            <h3>How Authentic Atmospheric Forecasting Works</h3>
            <p>The multi-stage scientific pipeline required for reliable predictive modeling</p>
          </div>
        </div>

        <div className="steps-flow">
          <div className="flow-step">
            <span className="step-circle">1</span>
            <div className="step-content">
              <strong>Ground Observations</strong>
              <p>Continuous particulate mass and precursor gas sensors (OpenAQ, CPCB, US EPA).</p>
            </div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <span className="step-circle">2</span>
            <div className="step-content">
              <strong>Satellite Remote Sensing</strong>
              <p>Aerosol Optical Depth (AOD) from NASA MODIS, VIIRS, and ESA Sentinel-5P.</p>
            </div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <span className="step-circle">3</span>
            <div className="step-content">
              <strong>Meteorological Coupling</strong>
              <p>Planetary boundary layer height, wind velocity fields, humidity, and temperature inversions.</p>
            </div>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <span className="step-circle">4</span>
            <div className="step-content">
              <strong>Chemical Transport Models</strong>
              <p>WRF-Chem / CMAQ simulations computing physical dispersion and aerosol chemistry.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Official External Resources */}
      <div className="panel official-sources-panel">
        <div className="section-heading">
          <div>
            <h3>Official Certified Forecasting Portals</h3>
            <p>Consult authoritative government agencies for operational multi-day air quality outlooks</p>
          </div>
        </div>

        <div className="sources-list">
          <div className="source-item">
            <div className="source-info">
              <strong>SAFAR-India (System of Air Quality and Weather Forecasting And Research)</strong>
              <p>Operated by the Ministry of Earth Sciences (MoES) and Indian Institute of Tropical Meteorology (IITM), Pune. Provides certified 1-to-3 day high-resolution city forecasts for Delhi-NCR, Pune, Mumbai, and Ahmedabad.</p>
            </div>
            <a href="https://safar.tropmet.res.in" target="_blank" rel="noopener noreferrer" className="btn-external">
              Visit SAFAR Portal ↗
            </a>
          </div>

          <div className="source-item">
            <div className="source-info">
              <strong>India Meteorological Department (IMD) - Air Quality Early Warning System (AQEWS)</strong>
              <p>Operational numerical forecast model designed to anticipate particulate surges, stubble burning smoke trajectories, and severe smog events across Northern India.</p>
            </div>
            <a href="https://mausam.imd.gov.in" target="_blank" rel="noopener noreferrer" className="btn-external">
              Visit IMD Early Warning ↗
            </a>
          </div>

          <div className="source-item">
            <div className="source-info">
              <strong>Copernicus Atmosphere Monitoring Service (CAMS)</strong>
              <p>European Centre for Medium-Range Weather Forecasts (ECMWF) global atmospheric composition and aerosol forecasts based on satellite data assimilation.</p>
            </div>
            <a href="https://atmosphere.copernicus.eu" target="_blank" rel="noopener noreferrer" className="btn-external">
              Visit Copernicus CAMS ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
