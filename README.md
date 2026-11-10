# BreatheWise 🌿

> **Evidence-Based Ambient Air Quality Intelligence & Station Comparison System**  
> Ground-station observations from **OpenAQ v3**; model-based forecasts from **Open-Meteo/CAMS**.

[![React](https://img.shields.io/badge/React-19.3-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646cff.svg)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-5.3-000000.svg)](https://expressjs.com/)
[![OpenAQ](https://img.shields.io/badge/OpenAQ-v3_API-00897b.svg)](https://openaq.org/)
[![Open-Meteo](https://img.shields.io/badge/Forecast-Open--Meteo-00a6a6.svg)](https://open-meteo.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900.svg)](https://leafletjs.com/)

---

## 📌 Executive Summary

**BreatheWise** is an ambient air quality monitoring and comparative analytics application designed with strict scientific and data integrity standards. It presents ground-station observations from OpenAQ v3 separately from model-based forecasts provided by Open-Meteo's CAMS-based air quality forecast.

### Core Scientific Principles:
1. **No Fabricated Observations:** Ground observations and historical trends come from monitoring stations; forecast estimates come from a named atmospheric model and are labeled as forecasts.
2. **PM2.5 Concentration vs. AQI Distinction:** Particulate mass concentration in micrograms per cubic meter ($\mu\text{g/m}^3$) is a physical density metric, whereas the Air Quality Index (AQI) is a mathematical non-linear composite index. BreatheWise clearly labels raw PM2.5 concentrations and references official Indian CPCB NAAQS 24-hour concentration brackets.
3. **Dual-Timestamp Integrity:** Explicit separation between when a physical sensor recorded an observation and when BreatheWise fetched/cached it from OpenAQ.
4. **Forecast Transparency:** Open-Meteo/CAMS output is identified as model-based, not a ground-station observation. Its US AQI values, when available, are not Indian CPCB AQI readings.

---

## 🏗 System Architecture & Supported Stations

### Technology Stack
- **Frontend:** React 19 and Vite 8; React Leaflet 5 with Leaflet 1.9 for interactive maps.
- **Observation data:** OpenAQ v3 ground-station API.
- **Forecast data:** Open-Meteo Air Quality API with a CAMS-based forecast.
- **Backend:** Express 5.3 on Node.js >= 20, serving as the data API proxy.

### Backend Architecture
- **Framework:** Express 5.3 (Node.js >= 20)
- **API Proxy:** In-memory caching (5-min for air quality, 15-min for historical measurements, 60-min for locations/sensors) with in-flight request deduplication to prevent rate limits.
- **Port Conflict Handling:** Gracefully detects `EADDRINUSE` errors on port 5000 and outputs actionable instructions.
- **Error Codes:** Structured JSON responses (`RATE_LIMITED`, `INVALID_ID`, `GATEWAY_TIMEOUT`, `UPSTREAM_AUTH_ERROR`, `NOT_FOUND`).

The frontend's curated station configuration contains **15 stations across 9 cities**. A city can have multiple selectable stations:

| City | Configured stations |
|---|---:|
| Ambala | 1 |
| Amritsar | 1 |
| Chandigarh | 3 |
| Faridabad | 1 |
| Gurugram | 1 |
| Jaipur | 3 |
| Ludhiana | 1 |
| New Delhi | 2 |
| Noida | 2 |

For example, New Delhi includes OpenAQ location `8118` (New Delhi / US Diplomatic Post; PM2.5 sensor `23534`) and location `17` (R K Puram, Delhi - DPCC). Ambala includes location `6964` (Patti Mehar, Ambala - HSPCB; PM2.5 sensor `14258997`). These are entries in the fixed selector catalog. The separate Ambala discovery endpoint also queries OpenAQ for nearby stations within 25 km.

---

## 🚀 Key Features & Implementation Breakdown

### 1. Multi-City & Multi-Station Selection
- Select among the **15 configured stations in 9 cities** using the city and station controls; station-dependent views update for the selected location.
- `GET /api/ambala-stations` queries OpenAQ v3 for monitoring stations within a 25 km radius of Ambala (`coordinates=30.378,76.776&radius=25000&parameters_id=2`).

### 2. Side-by-Side Station Comparison (`⇄ Compare Cities`)
- Choose any two different stations from the configured catalog, including stations in the same or different cities.
- Compare PM2.5 concentrations ($\mu\text{g/m}^3$), available historical 24-hour summaries, sensor timestamps, and the difference between readings.
- Multi-pollutant breakdown: PM2.5, PM10, $\text{NO}_2$, $\text{SO}_2$, $\text{CO}$, and $\text{O}_3$.

### 3. Advanced Historical Trends & Analytics (`▤ Historical Trends`)
- Toggle between **Latest 24 Readings** (hourly resolution) and **7-Day Historical Trend** (full dataset up to 1,000 measurements).
- Summary statistics: Current Reading, Period Average, Minimum, and Maximum.
- Interactive color-coded bars mapped directly to Indian CPCB NAAQS particulate concentration brackets (Good, Satisfactory, Moderate, Poor, Very Poor, Severe).
- Interactive hover tooltips displaying exact timestamp, concentration value, unit, and category.

### 4. Interactive Geospatial Map (`⌖ Air Quality Map`)
- Built with React Leaflet.
- Displays all 15 configured ground-monitoring stations across 9 cities with custom pins; filter the station list by city.
- Visualizes the 25 km discovery perimeter around Ambala as a dashed geodesic circle.
- Interactive popups featuring available PM2.5 values, coordinates, operator details, and a station-selection action.

### 5. Evidence-Based Health & Safety Guidance (`♡ Health & Safety`)
- Dynamic health risk assessment based on the active station's PM2.5 concentration level.
- Categorized recommendations for:
  - **General Population:** Outdoor workout timings, residential ventilation windows, cabin recirculation.
  - **Sensitive Groups:** Children, elderly individuals, asthma/COPD patients, cardiac risk mitigation.
  - **Physical Protective Interventions:** Certified N95/FFP2 respirators (explaining why surgical/cloth masks fail against PM2.5), True HEPA air filtration with CADR sizing, avoidance of indoor combustion sources.
- Complete Indian CPCB NAAQS 24-hr concentration reference table.
- Strict regulatory & medical disclaimer.

### 6. Model-Based Air Quality Forecast (`☼ Forecast`)
- Requests hourly PM2.5, PM10, and US AQI values from the Open-Meteo Air Quality API, which provides a CAMS-based forecast for the selected station's coordinates.
- Displays available future hours for the next 24 hours, with next-hour values, hourly charts, forecast location, IST timezone, and retrieval time.
- Clearly labels these as model estimates rather than ground-station measurements. Forecast availability depends on the upstream service and valid station coordinates.
- US AQI is shown where supplied by the forecast and is **not** Indian CPCB AQI; forecast PM concentrations are not observations or official CPCB readings.

### 7. Smart AQI Alerts (`🔔 Smart Alerts`)
- Evaluates the representative rolling 24-hour **ground-station PM2.5 average** against the CPCB NAAQS reference threshold of **60 µg/m³**. A BreatheWise advisory is generated only when that average is greater than 60 µg/m³; a single hourly reading does not trigger it.
- BreatheWise advisory severity tiers are based on that average: **Moderate** (>60–90), **Poor** (>90–120), **Very Poor** (>120–250), and **Severe** (>250 µg/m³). These are BreatheWise advisory tiers, **not official CPCB AQI categories**.
- Uses observations from the preceding 24 hours and requires at least 16 valid observations, 16 distinct hours, a time span of at least 18 hours, and coverage of at least 3 of 4 six-hour periods. Partial/provisional or clustered coverage is not enough to issue an alert.
- Suspends alert evaluation when the latest observation is more than 3 hours old. Missing history, insufficient temporal coverage, an unavailable PM2.5 sensor, or an API failure with no usable history is shown as a separate non-alert status; the app does not infer a value or issue a speculative alert.
- Alert history is station-specific and stored in browser `localStorage`. Identical station/severity/observation-time events are deduplicated; history is capped at 50 entries and supports dismiss/restore and clear-history actions.
- This is an informational exposure advisory, not an official CPCB AQI result, emergency declaration, or medical advice.

### 8. Dual Timestamp Transparency & Stale-Data Detection
- Displays two distinct timestamps for every reading:
  - **Measured by Sensor:** Local timestamp (IST) when the physical ground monitor sampled the air.
  - **Fetched from OpenAQ:** Timestamp when the BreatheWise proxy retrieved and cached the response.
- **Stale Data Warning:** Automatically flags measurements older than 3 hours with a prominent warning badge.
- **Rate-Limit Resilience:** In-memory caching (200-entry max, TTL-based) and automatic 30-second countdown retry banner upon HTTP 429 status.

---

## 🛠 Local Setup & Running Instructions

### Prerequisites
- **Node.js** >= 20.x
- **npm** >= 10.x
- OpenAQ API Key (Get a free key at [openaq.org](https://openaq.org/))

### 1. Clone & Install Dependencies

```bash
# Clone the repository
cd Breathbettter

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 2. Configure Environment Variables

**Backend (`server/.env`):**
```env
PORT=5000
OPENAQ_API_KEY=your_openaq_api_key_here
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
OPENAQ_TIMEOUT_MS=10000
```

**Frontend (`.env`):**
```env
VITE_API_BASE_URL=http://localhost:5000
```

### 3. Launch Development Servers

**Start Backend (Port 5000):**
```bash
cd server
npm run dev
```

**Start Frontend (Port 5173):**
```bash
# In a separate terminal at the project root:
npm run dev
```

Open your browser at `http://localhost:5173`.

### 4. Run Lint, Build & Automated Tests

```bash
# Run ESLint
npm run lint

# Run Vite production build
npm run build

# Run all declared automated tests from the repository root
npm test

# Optionally run the backend test suite by itself
cd server
npm test
```

The root `npm test` script uses Node's built-in test runner for PM2.5 standards and temporal-coverage utilities, station configuration and lookups, Smart Alerts thresholds/coverage/staleness/error handling/history, and backend health/catalog/location/air-quality/cache/API response behavior. The tests do not certify forecast accuracy.

---

## 🚢 Deployment Guide

### A. Backend Deployment on Render
1. Create a **New Web Service** on [Render.com](https://render.com/).
2. Select your repository.
3. Configure the service settings:
   - **Root Directory:** `server`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
4. Set Environment Variables in Render:
   - `OPENAQ_API_KEY`: *Your OpenAQ API Key*
   - `CORS_ORIGINS`: *Your Vercel frontend URL (e.g. `https://breathewise.vercel.app`)*
   - `NODE_VERSION`: `20`
5. Note your deployed Render backend URL (e.g. `https://breathewise-api.onrender.com`).

*(Or use the included `render.yaml` blueprint for one-click deployment).*

### B. Frontend Deployment on Vercel
1. Import your repository into [Vercel](https://vercel.com/).
2. Framework Preset: **Vite**.
3. Set the Environment Variable:
   - `VITE_API_BASE_URL`: `https://your-backend-app.onrender.com`
4. Deploy! The included `vercel.json` automatically manages single-page application (SPA) routing rewrites and security headers.

---

## 🎬 Hackathon Evaluator Demo Script

Follow this step-by-step walkthrough to demonstrate BreatheWise during evaluation:

| Step | Action | What to Observe / Demonstrate |
| :--- | :--- | :--- |
| **1. Startup & Health** | Open `http://localhost:5000/api/health` | Backend responds with `{ status: "success", hasApiKey: true }`. Demonstrate that port conflicts are intercepted safely. |
| **2. Overview & Timestamps** | Open `http://localhost:5173` | Point out the **Current Air Quality** card. Highlight the **Dual Timestamps**: *"Measured by Sensor"* (IST local time + relative age) vs. *"Fetched from OpenAQ"*. Point out the PM2.5 concentration level mapped to CPCB NAAQS standards. |
| **3. City & Station Switcher** | In the topbar, choose a city and station, such as **Ambala** / **Patti Mehar** | Notice the station-specific dashboard update. Location `6964` is the configured Patti Mehar, Ambala - HSPCB station. The selector supports 15 configured stations across 9 cities. |
| **4. Station Comparison** | Click **⇄ Compare Cities** in the sidebar | Select any two different configured stations. Review the **Difference Analysis**, coordinates, monitoring agencies, sensor times, and multi-pollutant comparison. Highlight that PM2.5 concentration is not the same as AQI. |
| **5. Historical Trends** | Click **▤ Historical Trends** in the sidebar | Switch between the **Latest 24 Readings** and **7-Day History**. Hover over chart bars to show interactive tooltips with timestamps and NAAQS threshold bands. Review the statistical summary (Average, Min, Max). |
| **6. Interactive Map** | Click **⌖ Air Quality Map** in the sidebar | Show the configured station markers, filter the station list by city, and select a station from its popup. Note the 25 km dashed discovery perimeter around Ambala. |
| **7. Evidence Health Guidance** | Click **♡ Health & Safety** in the sidebar | Review personalized recommendations for the General Population, Sensitive Groups, and Protective Interventions (N95 respirators vs cloth masks, HEPA air purifiers). Inspect the full CPCB NAAQS standard table. |
| **8. Forecast** | Click **☼ Forecast** in the sidebar | Review the Open-Meteo/CAMS-based hourly forecast for the selected station's coordinates, the next-24-hour PM2.5 and PM10 charts, and US AQI where available. Explain that these are model estimates, not ground-station observations or official CPCB AQI readings. |
| **9. Smart Alerts** | Click **🔔 Smart Alerts** in the sidebar | Review the 60 µg/m³ rolling 24-hour PM2.5 reference, BreatheWise severity tiers, temporal coverage and stale-data safeguards, and station-specific alert history. Clarify that the tiers are not official CPCB AQI categories. |

---

## 📄 License & Attribution
- Data Source: [OpenAQ v3 API](https://openaq.org/) under Open Data Commons Attribution License.
- Standards Reference: Central Pollution Control Board (CPCB), Ministry of Environment, Forest and Climate Change (MoEFCC), Government of India; World Health Organization (WHO) Global Air Quality Guidelines.
