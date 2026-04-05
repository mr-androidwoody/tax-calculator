/**
 * render-charts.js
 *
 * Renders the three main charts using Chart.js (loaded via CDN in index.html).
 *
 * Charts:
 *   1. Income sources — stacked bar per income type + dashed spending target line
 *   2. Tax paid & effective rate — bar (total tax) + line (eff. rate %)
 *   3. Wealth by type — stacked bar per wrapper type
 *
 * Each chart is destroyed and recreated on re-render to avoid Chart.js
 * stale-data issues with dataset mutations.
 *
 * Depends on: state.js, global Chart (from CDN)
 */

'use strict';

import { getViewPerson, getUseReal, getActiveRows } from './state.js';

// Keep references so we can destroy before recreating
const _charts = { income: null, tax: null, wealth: null };

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Re-render all three charts.
 *
 * @param {HTMLCanvasElement} incomeCanvas
 * @param {HTMLCanvasElement} taxCanvas
 * @param {HTMLCanvasElement} wealthCanvas
 */
export function renderCharts(incomeCanvas, taxCanvas, wealthCanvas) {
  const rows       = getActiveRows();
  const viewPerson = getViewPerson();
  const useReal    = getUseReal();

  destroyAll();

  if (!rows || rows.length === 0) return;

  const labels = rows.map(r => r.year);
  const adj    = (val, row) => useReal ? val * row.realDeflator : val;

  if (incomeCanvas) _charts.income = buildIncomeChart(incomeCanvas, rows, labels, adj, viewPerson);
  if (taxCanvas)    _charts.tax    = buildTaxChart(taxCanvas,    rows, labels, adj, viewPerson);
  if (wealthCanvas) _charts.wealth = buildWealthChart(wealthCanvas, rows, labels, adj);
}

// ---------------------------------------------------------------------------
// Chart builders
// ---------------------------------------------------------------------------

function buildIncomeChart(canvas, rows, labels, adj, viewPerson) {
  const sp = viewPerson === 'heidi' ? rows.map(r => adj(r.heidiSP, r))
           : viewPerson === 'woody' ? rows.map(r => adj(r.woodySP, r))
           : rows.map(r => adj(r.woodySP + r.heidiSP, r));

  const salary   = rows.map(r => adj(r.heidiSalInc, r));
  const qmmf     = rows.map(r => adj(r.qmmfDrawActual, r));
  const sippDraw = viewPerson === 'heidi'
    ? rows.map(r => adj(r.heidiDrawn.SIPP, r))
    : viewPerson === 'woody'
    ? rows.map(r => adj(r.woodyDrawn.SIPP, r))
    : rows.map(r => adj(r.woodyDrawn.SIPP + r.heidiDrawn.SIPP, r));

  const giaDraw = viewPerson === 'heidi'
    ? rows.map(r => adj(r.heidiDrawn.GIA, r))
    : viewPerson === 'woody'
    ? rows.map(r => adj(r.woodyDrawn.GIA, r))
    : rows.map(r => adj(r.woodyDrawn.GIA + r.heidiDrawn.GIA, r));

  const isaDraw = viewPerson === 'heidi'
    ? rows.map(r => adj(r.heidiDrawn.ISA, r))
    : viewPerson === 'woody'
    ? rows.map(r => adj(r.woodyDrawn.ISA, r))
    : rows.map(r => adj(r.woodyDrawn.ISA + r.heidiDrawn.ISA, r));

  const cashDraw = rows.map(r => adj(r.cashDrawn, r));
  const spending = rows.map(r => adj(r.spendingTarget, r));

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'State Pension',  data: sp,       backgroundColor: '#4ade80', stack: 'income' },
        { label: 'Salary',         data: salary,   backgroundColor: '#60a5fa', stack: 'income' },
        { label: 'QMMF draw',      data: qmmf,     backgroundColor: '#a78bfa', stack: 'income' },
        { label: 'SIPP draw',      data: sippDraw, backgroundColor: '#f97316', stack: 'income' },
        { label: 'GIA draw',       data: giaDraw,  backgroundColor: '#facc15', stack: 'income' },
        { label: 'ISA draw',       data: isaDraw,  backgroundColor: '#34d399', stack: 'income' },
        { label: 'Cash draw',      data: cashDraw, backgroundColor: '#94a3b8', stack: 'income' },
        {
          label: 'Spending target',
          data: spending,
          type: 'line',
          borderColor: '#ef4444',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          order: 0,
        },
      ],
    },
    options: chartOptions('Income sources (£)', useReal => useReal),
  });
}

function buildTaxChart(canvas, rows, labels, adj, viewPerson) {
  const totalTax = rows.map(r => {
    const wt = adj(r.woodyTax, r);
    const ht = adj(r.heidiTax, r);
    if (viewPerson === 'woody') return wt;
    if (viewPerson === 'heidi') return ht;
    return wt + ht;
  });

  const effRate = rows.map(r => {
    const tax   = viewPerson === 'woody' ? r.woodyTax
                : viewPerson === 'heidi' ? r.heidiTax
                : r.woodyTax + r.heidiTax;
    const spend = r.spendingTarget;
    return spend > 0 ? (tax / spend) * 100 : 0;
  });

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Total tax (£)', data: totalTax, backgroundColor: '#f87171', yAxisID: 'y' },
        {
          label: 'Effective rate (%)',
          data: effRate,
          type: 'line',
          borderColor: '#7c3aed',
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          yAxisID: 'y2',
        },
      ],
    },
    options: {
      ...chartOptions('Tax paid (£)'),
      scales: {
        x:  { stacked: false },
        y:  { title: { display: true, text: 'Tax (£)' } },
        y2: { position: 'right', title: { display: true, text: 'Eff. rate (%)' }, grid: { drawOnChartArea: false } },
      },
    },
  });
}

function buildWealthChart(canvas, rows, labels, adj) {
  const cash = rows.map(r => adj((r.snap.woodyCash || 0) + (r.snap.heidiCash || 0), r) / 1000);
  const qmmf = rows.map(r => adj(r.snap.woodyQMMF || 0, r) / 1000);
  const gia  = rows.map(r => adj((r.snap.woodyGIA  || 0) + (r.snap.heidiGIA  || 0), r) / 1000);
  const sipp = rows.map(r => adj((r.snap.woodySIPP || 0) + (r.snap.heidiSIPP || 0), r) / 1000);
  const isa  = rows.map(r => adj((r.snap.woodyISA  || 0) + (r.snap.heidiISA  || 0), r) / 1000);

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Cash',  data: cash, backgroundColor: '#94a3b8', stack: 'wealth' },
        { label: 'QMMF',  data: qmmf, backgroundColor: '#a78bfa', stack: 'wealth' },
        { label: 'GIA',   data: gia,  backgroundColor: '#facc15', stack: 'wealth' },
        { label: 'SIPP',  data: sipp, backgroundColor: '#f97316', stack: 'wealth' },
        { label: 'ISA',   data: isa,  backgroundColor: '#34d399', stack: 'wealth' },
      ],
    },
    options: chartOptions('Wealth by type (£k)'),
  });
}

// ---------------------------------------------------------------------------
// Shared chart options
// ---------------------------------------------------------------------------

function chartOptions(title) {
  return {
    responsive: true,
    animation: false,
    plugins: {
      title:   { display: !!title, text: title },
      legend:  { position: 'bottom' },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { stacked: true },
      y: { stacked: true, beginAtZero: true },
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function destroyAll() {
  for (const key of Object.keys(_charts)) {
    if (_charts[key]) {
      _charts[key].destroy();
      _charts[key] = null;
    }
  }
}
