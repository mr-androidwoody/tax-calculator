/**
 * app.js
 *
 * Application entry point.
 * Wires together: setup page, sidebar inputs, worker, state, and render modules.
 *
 * Responsibilities:
 *   - DOMContentLoaded init
 *   - Setup page → main app transition
 *   - Sidebar input reading (readInputs)
 *   - Worker lifecycle (create, message handling, re-run on demand)
 *   - Tab switching (Charts / Tax table / Assets table)
 *   - Person toggle (Both / Woody / Heidi)
 *   - Real / Nominal toggle
 *   - Re-render on state change
 */

'use strict';

import { TAX_2026_27 }         from './constants.js';
import { defaultInputs }       from './inputs.js';
import {
  setViewPerson, getViewPerson,
  setUseReal, getUseReal,
  storeScenarioResults, getActiveScenarioId,
  createScenario, subscribe,
}                              from './state.js';
import { initSetup, portfolioAccounts } from './setup.js';
import { wireScenarioPanel, renderScenarioList } from './scenarios.js';
import { renderMetrics, renderAlerts }   from './render-metrics.js';
import { renderTaxTable, renderAssetTable } from './render-tables.js';
import { renderCharts }        from './render-charts.js';

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

let _worker = null;

function getWorker() {
  if (!_worker) {
    _worker = new Worker('./js/worker.js', { type: 'module' });
    _worker.onmessage = onWorkerMessage;
    _worker.onerror   = e => console.error('Worker error:', e);
  }
  return _worker;
}

function onWorkerMessage(e) {
  const { type, rows, scenarioId, message } = e.data;
  if (type === 'RESULT') {
    storeScenarioResults(scenarioId, rows);
    hideSpinner();
  } else if (type === 'ERROR') {
    console.error('Projection error:', message);
    hideSpinner();
  }
}

// ---------------------------------------------------------------------------
// Run projection
// ---------------------------------------------------------------------------

function runProjection() {
  const inputs = readInputs();

  // Ensure there's an active scenario to store results against.
  let scenarioId = getActiveScenarioId();
  if (!scenarioId) {
    scenarioId = createScenario('Default', inputs);
  }

  showSpinner();
  getWorker().postMessage({ type: 'RUN', inputs, scenarioId });
}

// ---------------------------------------------------------------------------
// Input reading
// ---------------------------------------------------------------------------

/**
 * Read all sidebar inputs and return a ProjectionInputs object.
 * Falls back to defaultInputs() for any missing field.
 *
 * @returns {import('./inputs.js').ProjectionInputs}
 */
function readInputs() {
  const gv  = id => parseFloat(document.getElementById(id)?.value) || 0;
  const gvi = id => parseInt(document.getElementById(id)?.value, 10) || 0;
  const gvs = id => document.getElementById(id)?.value || '';
  const gvb = id => document.getElementById(id)?.checked || false;

  const thresholdMode = document.querySelector('input[name="thresholdMode"]:checked')?.value || 'frozen';

  const woodyOrder = [1, 2, 3, 4, 5].map(i => gvs(`woodyOrder${i}`)).filter(Boolean);
  const heidiOrder = [1, 2, 3, 4].map(i => gvs(`heidiOrder${i}`)).filter(Boolean);

  const bniEnabled = gvb('bniEnabled');

  return {
    woodyDOB:            gvi('woodyDOB'),
    heidiDOB:            gvi('heidiDOB'),
    startYear:           gvi('startYear'),
    endYear:             gvi('endYear'),
    spending:            gv('spending'),
    heidiSalary:         gv('heidiSalary'),
    heidiSalaryStopAge:  gvi('heidiSalaryStopAge'),
    woodySPAge:          gvi('woodySPAge'),
    woodySPAmt:          gv('woodySP'),
    heidiSPAge:          gvi('heidiSPAge'),
    heidiSPAmt:          gv('heidiSP'),
    woodyBal: {
      Cash: gv('woodyCash'),
      QMMF: gv('woodyQMMF'),
      GIA:  gv('woodyGIA'),
      SIPP: gv('woodySIPP'),
      ISA:  gv('woodyISA'),
    },
    heidiBal: {
      Cash: gv('heidiCash'),
      GIA:  gv('heidiGIA'),
      SIPP: gv('heidiSIPP'),
      ISA:  gv('heidiISA'),
    },
    woodyGIACostBasis:   gv('woodyGIACostBasis'),
    heidiGIACostBasis:   gv('heidiGIACostBasis'),
    qmmfAnnualRate:      gv('qmmfRate'),
    qmmfMonthlyDraw:     gv('qmmfMonthlyDraw'),
    growthRate:          gv('growth') / 100,
    inflationRate:       gv('inflation') / 100,
    withdrawalOrder: {
      woody: woodyOrder,
      heidi: heidiOrder,
    },
    bedAndISA: {
      enabled:   bniEnabled,
      woodyGIA:  bniEnabled ? gv('bniWoodyGIA')  : 0,
      woodyQMMF: bniEnabled ? gv('bniWoodyQMMF') : 0,
      heidiGIA:  bniEnabled ? gv('bniHeidiGIA')  : 0,
    },
    stepDownPct:         gv('stepDown1Pct'),
    thresholdMode,
    thresholdFromYear:   gvi('thresholdFromYearVal'),
    taxBands:            TAX_2026_27,
  };
}

// ---------------------------------------------------------------------------
// Preload sidebar
// ---------------------------------------------------------------------------

function preloadSidebar() {
  const d = defaultInputs();
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  set('woodyDOB',           d.woodyDOB);
  set('heidiDOB',           d.heidiDOB);
  set('startYear',          d.startYear);
  set('endYear',            d.endYear);
  set('spending',           d.spending);
  set('heidiSalary',        d.heidiSalary);
  set('heidiSalaryStopAge', d.heidiSalaryStopAge);
  set('woodySPAge',         d.woodySPAge);
  set('woodySP',            d.woodySPAmt);
  set('heidiSPAge',         d.heidiSPAge);
  set('heidiSP',            d.heidiSPAmt);
  set('woodyCash',          d.woodyBal.Cash);
  set('woodyQMMF',          d.woodyBal.QMMF);
  set('woodyGIA',           d.woodyBal.GIA);
  set('woodySIPP',          d.woodyBal.SIPP);
  set('woodyISA',           d.woodyBal.ISA);
  set('heidiCash',          d.heidiBal.Cash || 0);
  set('heidiGIA',           d.heidiBal.GIA);
  set('heidiSIPP',          d.heidiBal.SIPP);
  set('heidiISA',           d.heidiBal.ISA);
  set('woodyGIACostBasis',  d.woodyGIACostBasis);
  set('heidiGIACostBasis',  d.heidiGIACostBasis);
  set('qmmfRate',           d.qmmfAnnualRate);
  set('qmmfMonthlyDraw',    d.qmmfMonthlyDraw);
  set('growth',             d.growthRate * 100);
  set('inflation',          d.inflationRate * 100);
  set('stepDown1Pct',       d.stepDownPct);
  set('thresholdFromYearVal', d.thresholdFromYear);
}

// ---------------------------------------------------------------------------
// Render orchestration
// ---------------------------------------------------------------------------

function renderAll() {
  renderMetrics(document.getElementById('metrics-tiles'));
  renderActiveTab();
}

function renderActiveTab() {
  const active = document.querySelector('.tab-btn.active')?.dataset.tab;
  if (active === 'charts') {
    renderCharts(
      document.getElementById('income-chart'),
      document.getElementById('tax-chart'),
      document.getElementById('wealth-chart')
    );
  } else if (active === 'tax-table') {
    renderTaxTable(
      document.getElementById('tax-table-body'),
      document.getElementById('tax-table-foot')
    );
  } else if (active === 'asset-table') {
    renderAssetTable(document.getElementById('asset-table-body'));
  }
}

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.hidden = true);
      btn.classList.add('active');
      const panel = document.getElementById(`tab-${btn.dataset.tab}`);
      if (panel) panel.hidden = false;
      renderActiveTab();
    });
  });

  // Activate first tab by default
  const first = document.querySelector('.tab-btn');
  first?.click();
}

// ---------------------------------------------------------------------------
// Person + real/nominal toggles
// ---------------------------------------------------------------------------

function initToggles() {
  document.querySelectorAll('.person-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.person-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setViewPerson(btn.dataset.person);
    });
  });

  document.getElementById('toggle-real')?.addEventListener('click', () => {
    setUseReal(!getUseReal());
    document.getElementById('toggle-real').textContent = getUseReal() ? 'Real' : 'Nominal';
  });
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

function showSpinner() {
  const el = document.getElementById('run-spinner');
  if (el) el.hidden = false;
}
function hideSpinner() {
  const el = document.getElementById('run-spinner');
  if (el) el.hidden = true;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Setup page
  initSetup(
    document.getElementById('setup-page'),
    document.getElementById('main-app'),
    document.getElementById('accounts-tbody'),
    document.getElementById('btn-add-account'),
    document.getElementById('btn-continue'),
    () => {
      preloadSidebar();
      initTabs();
      initToggles();

      // Back to setup
      document.getElementById('btn-back-to-setup')?.addEventListener('click', () => {
        document.getElementById('main-app').style.display   = 'none';
        document.getElementById('setup-page').style.display = '';
      });

      // Run button
      document.getElementById('btn-run')?.addEventListener('click', runProjection);

      // BNI toggle — show/hide amount fields
      document.getElementById('bniEnabled')?.addEventListener('change', function() {
        const fields = document.getElementById('bni-fields');
        if (fields) fields.hidden = !this.checked;
      });

      // Scenario panel
      wireScenarioPanel(
        document.getElementById('scenario-list'),
        document.getElementById('btn-save-scenario'),
        document.getElementById('scenario-name-input'),
        readInputs,
        id => {
          // On load: re-render with stored results (no re-run needed)
          renderAll();
        }
      );

      // Re-render whenever state changes (results stored, toggles, etc.)
      subscribe(renderAll);
    }
  );
});
