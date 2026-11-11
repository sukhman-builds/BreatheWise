# BreatheWise

BreatheWise is a web dashboard for exploring ambient air-quality observations and forecasts for a curated set of monitoring stations in northern India. It brings station readings, historical measurements, location comparisons, health context, and forecast summaries into one interface while distinguishing measured data from model output.

## The problem it addresses

Air-quality numbers are easy to misread: a PM2.5 mass concentration is not itself an Air Quality Index, a single sensor observation is not a 24-hour mean, and a model forecast is not a ground measurement. BreatheWise presents those data types with their source, timestamps, coverage, and limitations so users can make more informed comparisons without treating incomplete or stale data as current.

## Implemented features

- **Station dashboard and selection:** Switch among 15 configured monitoring stations in 9 cities. The overview shows the latest available pollutant readings, PM2.5 context, sensor measurement time, proxy fetch time, and stale-data status.
- **Pollutant readings:** Displays available PM2.5, PM10, NO₂, SO₂, CO, and O₃ readings. Values depend on which sensors report data at a station.
- **Station comparison:** Compare two configured stations, including available PM2.5 readings, historical summaries, timestamps, and pollutant measurements.
- **Historical trends:** Explore recent PM2.5 readings or up to seven days of station history, with averages, minimums, maximums, and an observation timeline.
- **Monitoring map:** Browse configured stations on a Leaflet map, filter by city, and select a station. The map also shows the 25 km Ambala discovery area; the backend can query OpenAQ for stations in that area.
- **Health and standards reference:** Provides general and sensitive-group guidance and an Indian CPCB PM2.5 24-hour NAAQS reference. The information is advisory, not medical advice.
- **Air-quality forecast:** Shows hourly forecast PM2.5, PM10, and US AQI values for the selected station's coordinates. Forecast values are clearly identified as model output.
- **Clean-air window:** Uses available forecast PM2.5 values to identify a recommended three-hour outdoor-activity window. This is a forecast-based suggestion, not a guarantee of conditions.
- **Smart alerts:** Evaluates representative rolling 24-hour ground-station PM2.5 data against the 60 µg/m³ CPCB 24-hour reference. It requires sufficient temporal coverage, suppresses stale observations, and maintains station-specific alert history in browser storage.
- **PM2.5 city leaderboard:** Ranks cities by the latest available instantaneous PM2.5 ground-station concentration from each city's configured default station. This is not an official AQI ranking or a ranking of regulatory 24-hour NAAQS categories; stale and unreported cities are identified rather than treated as current values.
- **Saved locations:** Bookmark stations for quick access. Favorites are stored in the browser's `localStorage`; there is no account or cloud sync.
- **Weekly report:** Summarizes the selected station's available seven-day PM2.5 history, including daily coverage and cleanest/most polluted day summaries. Its minimum of 16 distinct observation hours per day is an application-defined data-quality rule for deciding whether a day has sufficient coverage for the application's daily category/compliance evaluation; it is not an official CPCB coverage requirement. Days below the threshold are marked insufficient rather than compliant or exceeded.
- **Data reliability monitor:** Shows reading freshness, cache/API status, and station data availability.
- **Resilience and transparency:** The API client and backend use in-memory caching and request deduplication. OpenAQ requests have bounded retries, and eligible cached readings can be served as explicitly stale data during upstream failures.

## PM2.5 concentration and AQI are different

PM2.5 in µg/m³ is a particulate mass concentration. AQI is an index calculated using a defined methodology; the application does not calculate or claim to report an official CPCB AQI. CPCB NAAQS PM2.5 concentration categories and the 60 µg/m³ 24-hour reference are contextual standards, not an AQI conversion for an isolated reading.

The overview may label a single observation with a concentration-based snapshot category, but it is not a regulatory 24-hour result. The city leaderboard sorts latest instantaneous PM2.5 concentrations, not AQI values or regulatory 24-hour NAAQS categories. The alert and weekly-report modules separately apply application coverage rules to historical measurements; the weekly report's 16-hour rule is not an official CPCB requirement. Open-Meteo's `us_aqi`, when present, is the US index and must not be interpreted as Indian CPCB AQI.

## Data sources and limitations

- **OpenAQ v3:** The backend retrieves monitoring-location metadata, sensor lists, latest observations, historical measurements, and nearby Ambala stations. The frontend and backend station catalogs are curated configurations, not a complete directory of all monitoring sites.
- **Open-Meteo Air Quality API:** The backend requests hourly `pm2_5`, `pm10`, and `us_aqi` values from its CAMS-based air-quality forecast for the selected coordinates. These are model estimates, not station readings.
- **Map tiles:** The map uses OpenStreetMap tiles.

Coverage and freshness vary by station, pollutant, and upstream provider. Missing data remains unavailable rather than being inferred as zero. The dashboard flags observations older than three hours as stale. The backend's in-memory cache can provide eligible stale OpenAQ or forecast responses for up to 24 hours after their cache entry was stored; a stale response is not a live reading. Backend cache entries are not persistent across process restarts.

Historical retrieval is limited to the preceding seven days and at most 1,000 measurements per request. City rankings cover only the configured cities and rely on available station observations. Forecast availability and accuracy depend on Open-Meteo and the model's spatial and temporal coverage. Neither forecasts nor health guidance replace official monitoring, professional advice, or emergency instructions.

## Technology

- **Frontend:** React 19, JavaScript/JSX, Vite 8
- **Mapping:** React Leaflet 5 and Leaflet 1.9
- **Backend:** Node.js 20 or later, Express 5, CORS, dotenv
- **Data services:** OpenAQ v3 and Open-Meteo Air Quality API
- **Tests:** Node.js built-in test runner (`node:test`)
- **Deployment configuration:** Render (`render.yaml`) and Vercel (`vercel.json`)

## Architecture and project structure

The Vite frontend calls the Express API. The backend keeps the OpenAQ API key server-side, proxies OpenAQ and Open-Meteo requests, and adds validation, caching, retry handling, and response metadata. Browser-side utilities compute presentation summaries, alert eligibility, weekly reports, and saved-location state.

```text
.
+-- public/
|   +-- favicon.svg
|   `-- icons.svg
+-- server/
|   +-- .env.example
|   +-- index.js
|   +-- package.json
|   +-- package-lock.json
|   +-- stations.js
|   `-- test-server.js
+-- src/
|   +-- api/
|   |   `-- client.js
|   +-- assets/
|   |   +-- hero.png
|   |   +-- react.svg
|   |   `-- vite.svg
|   +-- components/
|   |   +-- AlertsView.jsx
|   |   +-- CleanAirWindow.jsx
|   |   +-- CompareView.jsx
|   |   +-- ForecastView.jsx
|   |   +-- HealthView.jsx
|   |   +-- LeaderboardView.jsx
|   |   +-- MapView.jsx
|   |   +-- MyLocationsView.jsx
|   |   +-- ReliabilityView.jsx
|   |   +-- TrendsView.jsx
|   |   `-- WeeklyReportView.jsx
|   +-- config/
|   |   `-- stations.js
|   +-- utils/
|   |   +-- cleanAirWindow.js
|   |   +-- dataReliability.js
|   |   +-- favorites.js
|   |   +-- leaderboard.js
|   |   +-- pm25Standards.js
|   |   +-- smartAlerts.js
|   |   `-- weeklyReport.js
|   +-- App.css
|   +-- App.jsx
|   +-- config.js
|   +-- index.css
|   `-- main.jsx
+-- tests/
|   +-- apiClient.test.js
|   +-- apiReliability.test.js
|   +-- cleanAirWindow.test.js
|   +-- dataReliability.test.js
|   +-- favorites.test.js
|   +-- leaderboard.test.js
|   +-- pm25Standards.test.js
|   +-- smartAlerts.test.js
|   +-- stationsConfig.test.js
|   `-- weeklyReport.test.js
+-- .env.example
+-- .gitignore
+-- README.md
+-- eslint.config.js
+-- index.html
+-- package.json
+-- package-lock.json
+-- render.yaml
+-- vercel.json
`-- vite.config.js
```

## Local setup

### Prerequisites

- Node.js 20 or later (the backend package requires `node >=20`)
- npm
- An OpenAQ API key for OpenAQ-backed API requests

### Install and configure

From the repository root, install both packages and create local environment files from the checked-in templates:

```powershell
npm install
npm --prefix server install
Copy-Item .env.example .env
Copy-Item server\.env.example server\.env
```

Set the OpenAQ key in `server\.env` locally. Do not commit either `.env` file or put the OpenAQ key in a frontend variable. The root `.env` is for the Vite frontend; `server\.env` is read by the backend.

### Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | Frontend | Backend API base URL. If unset, the frontend uses `http://localhost:5000`. |
| `OPENAQ_API_KEY` | Backend | API key sent by the server to OpenAQ v3. Required for OpenAQ-backed requests. |
| `PORT` | Backend | HTTP listen port; defaults to `5000` when unset. |
| `CORS_ORIGINS` | Backend | Comma-separated browser origins permitted by CORS. Set this to the deployed frontend origin in production. |
| `OPENAQ_TIMEOUT_MS` | Backend | Timeout for OpenAQ requests in milliseconds; the server defaults to 15,000 ms if unset. The checked-in backend template and Render blueprint set it to 10,000 ms. |

The Render blueprint also configures `NODE_VERSION` and supplies a value for `OPENAQ_TIMEOUT_MS`. Keep secret values in local environment files or the hosting provider's secret/environment settings; never put API keys in client-side variables.

### Run the application

Start the backend in one terminal:

```powershell
cd server
npm run dev
```

Start the frontend from the repository root in another terminal:

```powershell
npm run dev
```

Open the local Vite URL shown in the terminal (normally `http://localhost:5173`). The backend health endpoint is available at `http://localhost:5000/api/health`.

For a production-mode backend process, run `npm start` from `server`. To serve a local production frontend build, run `npm run build` and then `npm run preview` from the repository root.

## Backend API

All routes below are implemented in `server/index.js` and use `GET`.

| Endpoint | Behavior |
|---|---|
| `/api/health` | Backend health, timestamp, and a boolean indicating whether an OpenAQ key is configured. |
| `/api/stations` | Curated station and city catalog. |
| `/api/stations?city=<city>` | Curated stations for the requested city. |
| `/api/location/:locationId` | OpenAQ location metadata and coordinates, with configured-catalog fallback where available. |
| `/api/location-sensors/:locationId` | Sensor IDs and parameter/unit metadata for an OpenAQ location. |
| `/api/air-quality/:locationId` | Latest available sensor observation per pollutant for a location, plus fetch/stale metadata. |
| `/api/history/:sensorId` | Valid measurements for the preceding seven days (request limit 1,000). |
| `/api/ambala-stations` | OpenAQ location discovery for PM2.5 monitors within 25 km of the configured Ambala reference point. |
| `/api/forecast?latitude=<lat>&longitude=<lon>` | Open-Meteo hourly PM2.5, PM10, and US AQI forecast for valid coordinates. |

Invalid IDs or coordinates return structured JSON errors; unknown `/api` routes return a JSON 404. OpenAQ-backed routes require the backend key, while the station catalog, health check, and Open-Meteo forecast have their own route behavior.

## Tests, lint, and build

Run these commands from the repository root:

```powershell
npm test
npm run lint
npm run build
```

- `npm test` runs the listed Node tests for API-client behavior, data reliability, PM2.5 standards, station configuration, alerts, favorites, leaderboards, clean-air windows, and weekly reports. It also runs `server/test-server.js`, which exercises backend routes including OpenAQ-backed requests; those integration cases need network access and a working backend OpenAQ key.
- `npm run lint` runs `eslint .` using the root ESLint configuration for frontend and server JavaScript.
- `npm run build` runs `vite build` to create the production frontend in `dist/`.

The backend package also defines `npm test` (`node --test`), which runs `server/test-server.js`; this is the same backend test file included in the root test script. To run that package's test command separately:

```powershell
cd server
npm test
```

## Deployment

There is no production application URL hard-coded in the repository configuration. Deployments use the hosting providers' generated URLs.

### Backend on Render

The [Render blueprint](./render.yaml) defines a Node web service rooted at `server`, with `npm install` as its build command, `npm start` as its start command, and `/api/health` as its health check. It declares `OPENAQ_API_KEY` and `CORS_ORIGINS` as values to supply in Render, and configures `PORT`, `NODE_VERSION`, and `OPENAQ_TIMEOUT_MS`. Set `CORS_ORIGINS` to the exact deployed frontend origin and keep the OpenAQ key in Render's environment settings.

See [Render](https://render.com/) to create or deploy the service.

### Frontend on Vercel

The [Vercel configuration](./vercel.json) declares the Vite framework, rewrites application routes to `/` for the single-page app, and adds response security headers. Deploy the repository root as the Vite project and set `VITE_API_BASE_URL` to the deployed backend's base URL in the Vercel project environment.

See [Vercel](https://vercel.com/) to deploy the frontend.

## Known limitations and possible future scope

Current limitations include the fixed station catalog, uneven upstream sensor coverage, seven-day/1,000-measurement history limit, non-persistent server cache, and browser-local saved locations and alert history. A forecast is model output, and US AQI is not Indian CPCB AQI. The project does not provide an official AQI calculation or a substitute for official monitoring.

Possible future work includes expanding and maintaining station coverage, adding longer-term history and durable user-synced preferences, improving forecast validation and provenance, and providing additional data-quality and accessibility improvements. These are future ideas, not current features.

## References

- [OpenAQ API documentation](https://docs.openaq.org/)
- [Open-Meteo Air Quality API documentation](https://open-meteo.com/en/docs/air-quality-api)
- [Central Pollution Control Board](https://cpcb.nic.in/)
- [OpenStreetMap](https://www.openstreetmap.org/) map data
