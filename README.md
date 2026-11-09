# BreatheWise 🌿

> **Evidence-Based Ambient Air Quality Intelligence & Station Comparison System**  
> Powered by authentic ground-level observations from the **OpenAQ v3 API**.

[![React](https://img.shields.io/badge/React-19.3-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646cff.svg)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-5.3-000000.svg)](https://expressjs.com/)
[![OpenAQ](https://img.shields.io/badge/OpenAQ-v3_API-00897b.svg)](https://openaq.org/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900.svg)](https://leafletjs.com/)

---

## 📌 Executive Summary

**BreatheWise** is an ambient air quality monitoring and comparative analytics application designed with strict scientific and data integrity standards. Rather than presenting arbitrary, fabricated or synthetic numbers, BreatheWise exclusively queries verified physical measurements recorded by ground-based ambient monitoring sensors archived in OpenAQ v3.

### Core Scientific Principles:
1. **Zero Data Fabrication:** No imaginary stations, fake historical trends, or synthetic forecasts.
2. **PM2.5 Concentration vs. AQI Distinction:** Particulate mass concentration in micrograms per cubic meter ($\mu\text{g/m}^3$) is a physical density metric, whereas the Air Quality Index (AQI) is a mathematical non-linear composite index. BreatheWise clearly labels raw PM2.5 concentrations and references official Indian CPCB NAAQS 24-hour concentration brackets.
3. **Dual-Timestamp Integrity:** Explicit separation between when a physical sensor recorded an observation and when BreatheWise fetched/cached it from OpenAQ.
4. **Honest Forecast Disclosure:** Transparently declares when future forecasts are unavailable, explaining why direct sensor networks do not compute numerical dispersion models.

---

## 🏗 System Architecture & Verified Stations

### Backend Architecture
- **Framework:** Express 5.3 (Node.js >= 20)
- **API Proxy:** In-memory caching (5-min for air quality, 15-min for historical measurements, 60-min for locations/sensors) with in-flight request deduplication to prevent rate limits.
- **Port Conflict Handling:** Gracefully detects `EADDRINUSE` errors on port 5000 and outputs actionable instructions.
- **Error Codes:** Structured JSON responses (`RATE_LIMITED`, `INVALID_ID`, `GATEWAY_TIMEOUT`, `UPSTREAM_AUTH_ERROR`, `NOT_FOUND`).

### Active Monitored Stations
1. **New Delhi (National Capital Region)**
   - **OpenAQ Location ID:** `8118`
   - **Active PM2.5 Sensor ID:** `23534`
   - **Coordinates:** $28.6358^\circ\text{N}, 77.2245^\circ\text{E}$
   - **Station Type:** Continuous Ambient Air Quality Monitor (US Diplomatic Post / Central MoEFCC)
2. **Ambala (Northern Plains Corridor - Within 25 km Discovery Radius)**
   - **OpenAQ Location ID:** `6964` (`Patti Mehar, Ambala - HSPCB`)
   - **Active PM2.5 Sensor ID:** `14258997`
   - **Coordinates:** $30.3796^\circ\text{N}, 76.7783^\circ\text{E}$ (Distance: ~240m from Ambala reference center)
   - **Operating Agency:** Haryana State Pollution Control Board (HSPCB) / CPCB

---

## 🚀 Key Features & Implementation Breakdown

### 1. Authentic Station Discovery & City Switcher
- `GET /api/ambala-stations`: Dynamically queries OpenAQ v3 for monitoring stations within a strict 25 km radius (`coordinates=30.378,76.776&radius=25000&parameters_id=2`).
- Seamlessly switch between **New Delhi** and **Ambala** via the topbar dropdown; all views, historical trends, and map markers update reactively.

### 2. Side-by-Side City Comparison (`⇄ Compare Cities`)
- Live comparative matrix between New Delhi and Ambala.
- Side-by-side PM2.5 concentrations ($\mu\text{g/m}^3$) with independent sensor timestamps and fetch timestamps.
- Mathematical difference analysis (e.g. *"Ambala PM2.5 is X $\mu\text{g/m}^3$ lower than New Delhi"*).
- Multi-pollutant breakdown: PM2.5, PM10, $\text{NO}_2$, $\text{SO}_2$, $\text{CO}$, and $\text{O}_3$.

### 3. Advanced Historical Trends & Analytics (`▤ Historical Trends`)
- Toggle between **Latest 24 Readings** (hourly resolution) and **7-Day Historical Trend** (full dataset up to 1,000 measurements).
- Summary statistics: Current Reading, Period Average, Minimum, and Maximum.
- Interactive color-coded bars mapped directly to Indian CPCB NAAQS particulate concentration brackets (Good, Satisfactory, Moderate, Poor, Very Poor, Severe).
- Interactive hover tooltips displaying exact timestamp, concentration value, unit, and category.

### 4. Interactive Geospatial Map (`⌖ Air Quality Map`)
- Built with React Leaflet.
- Displays both New Delhi and Ambala with custom retina SVG pins.
- Visualizes the 25 km discovery perimeter around Ambala as a dashed geodesic circle.
- Interactive popups featuring live PM2.5 values, coordinates, operator details, and an instant station-selection trigger.

### 5. Evidence-Based Health & Safety Guidance (`♡ Health & Safety`)
- Dynamic health risk assessment based on the active station's PM2.5 concentration level.
- Categorized recommendations for:
  - **General Population:** Outdoor workout timings, residential ventilation windows, cabin recirculation.
  - **Sensitive Groups:** Children, elderly individuals, asthma/COPD patients, cardiac risk mitigation.
  - **Physical Protective Interventions:** Certified N95/FFP2 respirators (explaining why surgical/cloth masks fail against PM2.5), True HEPA air filtration with CADR sizing, avoidance of indoor combustion sources.
- Complete Indian CPCB NAAQS 24-hr concentration reference table.
- Strict regulatory & medical disclaimer.

### 6. Honest Forecast Unavailability Disclosure (`☼ Forecast`)
- Explicitly states: **"Air Quality Forecast Currently Unavailable"**.
- Transparently discloses that OpenAQ v3 is an observational archive and does not generate predictive dispersion models.
- Explains why fabricating synthetic forecasts would be unethical and dangerous.
- Educational breakdown of authentic atmospheric modeling (WRF-Chem, planetary boundary layers, satellite AOD assimilation).
- Verified external links to certified forecasting authorities (SAFAR-India, IMD Early Warning, Copernicus CAMS).

### 7. Dual Timestamp Transparency & Stale-Data Detection
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

### 4. Run Lint & Automated Tests

```bash
# Run ESLint (0 errors, 0 warnings across frontend & backend)
npm run lint

# Run Vite Production Build
npm run build

# Run Backend Automated Test Suite
node --test server/test-server.js
```

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
| **3. Station Switcher** | In the topbar, switch from **New Delhi** to **Ambala** | Notice the seamless transition. The dashboard loads authentic data for location `6964` (*Patti Mehar, Ambala - HSPCB*), updating the PM2.5 reading, pollutant grid, and map. |
| **4. City Comparison** | Click **⇄ Compare Cities** in the sidebar | Demonstrate the side-by-side comparison between New Delhi and Ambala (the genuine station within 25 km). Review the **Difference Analysis** banner, coordinates, monitoring agencies, and multi-pollutant comparison table. Highlight the scientific notice clarifying that PM2.5 concentration is not AQI. |
| **5. Historical Trends** | Click **▤ Historical Trends** in the sidebar | Switch between the **Latest 24 Readings** and **7-Day History**. Hover over chart bars to show interactive tooltips with timestamps and NAAQS threshold bands. Review the statistical summary (Average, Min, Max). |
| **6. Interactive Map** | Click **⌖ Air Quality Map** in the sidebar | Show both markers on the Leaflet map. Click either station card to fly to that coordinate. Note the 25 km dashed discovery perimeter around Ambala. |
| **7. Evidence Health Guidance** | Click **♡ Health & Safety** in the sidebar | Review personalized recommendations for the General Population, Sensitive Groups, and Protective Interventions (N95 respirators vs cloth masks, HEPA air purifiers). Inspect the full CPCB NAAQS standard table. |
| **8. Honest Forecast** | Click **☼ Forecast** in the sidebar | Show the prominent **"Forecast Unavailable"** status card. Explain how BreatheWise adheres to zero hallucination / zero fabrication principles, and review the educational breakdown of authentic atmospheric modeling. |

---

## 📄 License & Attribution
- Data Source: [OpenAQ v3 API](https://openaq.org/) under Open Data Commons Attribution License.
- Standards Reference: Central Pollution Control Board (CPCB), Ministry of Environment, Forest and Climate Change (MoEFCC), Government of India; World Health Organization (WHO) Global Air Quality Guidelines.
