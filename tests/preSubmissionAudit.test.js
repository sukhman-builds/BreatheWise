import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateWeeklyReport } from '../src/utils/weeklyReport.js';
import { getStationById } from '../src/config/stations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

test('Audit Regression: 16-hour weekly report threshold is explicitly described as application-defined', () => {
  const station = getStationById(8118);
  const now = new Date('2026-11-10T20:00:00+05:30').getTime();

  // Test incomplete day
  const incompleteMeasurements = [
    { value: 45, datetime: '2026-11-10T10:00:00+05:30' },
    { value: 50, datetime: '2026-11-10T11:00:00+05:30' }
  ];

  const report = generateWeeklyReport(incompleteMeasurements, station, now);

  // Regulatory notice must explicitly mention application-defined criteria, NOT attribute the 16h rule to CPCB itself
  assert.ok(
    report.regulatoryNotice.includes('application-defined'),
    'Regulatory notice must state that 16h threshold is application-defined'
  );
  assert.ok(
    !report.regulatoryNotice.includes('In accordance with CPCB protocols, compliance is evaluated only for days with ≥16 hours'),
    'Must not misattribute the 16h completeness rule to official CPCB statutory protocols'
  );

  const incompleteDay = report.dailyBreakdown.find(d => d.hasData);
  assert.ok(incompleteDay);
  assert.ok(
    incompleteDay.note.includes('application threshold') || incompleteDay.note.includes('Insufficient diurnal coverage'),
    'Daily note must describe the coverage threshold as application-defined'
  );

  // Verify WeeklyReportView.jsx text
  const weeklyReportViewCode = fs.readFileSync(
    path.join(projectRoot, 'src', 'components', 'WeeklyReportView.jsx'),
    'utf-8'
  );
  assert.ok(
    weeklyReportViewCode.includes('application-defined'),
    'WeeklyReportView.jsx must mention application-defined completeness criterion'
  );
  assert.ok(
    !weeklyReportViewCode.includes('Per CPCB scientific criteria, incomplete days (<16 hours)'),
    'Must not state that 16 hours is a CPCB statutory criterion'
  );

  // Verify AlertsView.jsx text
  const alertsViewCode = fs.readFileSync(
    path.join(projectRoot, 'src', 'components', 'AlertsView.jsx'),
    'utf-8'
  );
  assert.ok(
    alertsViewCode.includes('application-defined'),
    'AlertsView.jsx must mention application-defined coverage rule'
  );
});

test('Audit Regression: CSS mobile responsiveness rules and select/dropdown constraints', () => {
  const appCss = fs.readFileSync(path.join(projectRoot, 'src', 'App.css'), 'utf-8');

  // Verify select and dropdown constraints
  assert.ok(appCss.includes('.city-dropdown'), 'Must define .city-dropdown');
  assert.ok(appCss.includes('.station-dropdown'), 'Must define .station-dropdown');

  // Verify responsive select rules: width, min-width 0, text-overflow ellipsis
  assert.ok(
    appCss.includes('text-overflow: ellipsis;'),
    'Select controls must truncate cleanly with text-overflow: ellipsis'
  );

  // Verify that the global-city-selector-wrap has responsive grid/flex layout for mobile
  assert.ok(
    appCss.includes('grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr) auto;'),
    'Must have responsive 3-column topbar grid on mobile'
  );

  // Verify that duplicate city active indicator is hidden on mobile screens
  assert.ok(
    appCss.includes('.city-active-indicator {\n    display: none !important;\n  }') ||
    appCss.includes('.city-active-indicator {\n    display: none !important;'),
    'Must hide redundant city indicator on mobile screens'
  );

  // Verify compact swap button on mobile
  assert.ok(
    appCss.includes('border-radius: 50%') || appCss.includes('border-radius: 14px'),
    'Compare swap button must be sleek/compact on mobile'
  );

  // Verify touch-friendly horizontal scrollbar for city filter bar
  assert.ok(
    appCss.includes('overflow-x: auto;') && appCss.includes('-webkit-overflow-scrolling: touch;'),
    'City filter bar must support smooth touch scrolling'
  );

  // Verify ultra-narrow mobile breakpoint (320px to 359px) exists
  assert.ok(
    appCss.includes('@media (max-width: 359px)'),
    'Must include ultra-narrow mobile breakpoint for 320px devices'
  );

  // Verify no unconstrained minmax(300px, 1fr) in saved-stations-grid
  assert.ok(
    !appCss.includes('grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));'),
    'saved-stations-grid must not have unconstrained minmax(300px, 1fr)'
  );
});

test('Audit Regression: Symmetrical topbar station selector icon structure', () => {
  const appJsx = fs.readFileSync(path.join(projectRoot, 'src', 'App.jsx'), 'utf-8');

  // Ensure both city and station selector boxes have location-pin-icon
  assert.ok(
    appJsx.includes('<div className="city-selector-box">\n              <span className="location-pin-icon">📍</span>'),
    'City selector must have location pin icon'
  );
  assert.ok(
    appJsx.includes('<div className="station-selector-box">\n              <span className="location-pin-icon">📡</span>'),
    'Station selector must have symmetrical station icon'
  );
});
