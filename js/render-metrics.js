/**
 * render-metrics.js
 *
 * Renders the five summary metric tiles and depletion alerts.
 *
 * Tiles:
 *   1. Total tax paid (income tax + CGT, both persons, all years)
 *   2. Average effective rate (all projection years)
 *   3. Steady-state effective rate (post-SP years only)
 *   4. Peak tax year (year + amount)
 *   5. Portfolio at end (final year total)
 *
 * Depends on: state.js (for viewPerson, useReal, rows)
 */

'use strict';

import { getViewPerson, getUseReal, getActiveRows } from './state.js';

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Re-render all metric tiles.
 * Call whenever rows, viewPerson, or useReal changes.
 *
 * @param {HTMLElement} tilesContainer  Element containing the five .metric-tile divs
 */
export function renderMetrics(tilesContainer) {
  const rows       = getActiveRows();
  const viewPerson = getViewPerson();
  const useReal    = getUseReal();

  if (!tilesContainer) return;

  if (!rows || rows.length === 0) {
    tilesContainer.innerHTML = '<p class="metrics-empty">Run projection to see results.</p>';
    return;
  }

  const metrics = computeMetrics(rows, viewPerson, useReal);
  tilesContainer.innerHTML = tilesHtml(metrics, rows, viewPerson);
}

/**
 * Render depletion alerts.
 *
 * @param {HTMLElement} alertsContainer
 * @param {{ [key: string]: { year: number, age: number } }} depletions
 */
export function renderAlerts(alertsContainer, depletions) {
  if (!alertsContainer) return;
  alertsContainer.innerHTML = '';

  const entries = Object.entries(depletions || {});
  if (entries.length === 0) return;

  const ul = document.createElement('ul');
  ul.className = 'depletion-alerts';
  for (const [key, { year, age }] of entries) {
    const li = document.createElement('li');
    li.textContent = `${key} depleted in ${year} (age ${age})`;
    ul.appendChild(li);
  }
  alertsContainer.appendChild(ul);
}

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

/**
 * @param {import('./projection-engine.js').ProjectionRow[]} rows
 * @param {'both'|'woody'|'heidi'} viewPerson
 * @param {boolean} useReal
 */
function computeMetrics(rows, viewPerson, useReal) {
  const adj = (val, row) => useReal ? val * row.realDeflator : val;

  const taxForRow = row => {
    if (viewPerson === 'woody') return row.woodyTax;
    if (viewPerson === 'heidi') return row.heidiTax;
    return row.woodyTax + row.heidiTax;
  };

  const spendForRow = row => adj(row.spendingTarget, row);
  const taxAdjForRow = row => adj(taxForRow(row), row);

  // Total tax
  const totalTax = rows.reduce((s, r) => s + taxAdjForRow(r), 0);

  // Effective rate per year = tax / spendingTarget (proxy for gross draw)
  const effRates = rows.map(r => {
    const spend = spendForRow(r);
    return spend > 0 ? taxAdjForRow(r) / spend : 0;
  });
  const avgEffRate = effRates.reduce((s, v) => s + v, 0) / effRates.length;

  // Steady-state: years where both persons are past SP age
  const ssRows = rows.filter(r => {
    const inputs = null; // SP ages not in rows — use proxy: woodySP > 0
    return r.woodySP > 0 && r.heidiSP > 0;
  });
  const ssEffRate = ssRows.length > 0
    ? ssRows.reduce((s, r) => {
        const spend = spendForRow(r);
        return s + (spend > 0 ? taxAdjForRow(r) / spend : 0);
      }, 0) / ssRows.length
    : null;
  const ssYearRange = ssRows.length > 0
    ? `${ssRows[0].year}–${ssRows[ssRows.length - 1].year}`
    : null;

  // Peak tax year
  let peakRow = rows[0];
  for (const r of rows) {
    if (taxAdjForRow(r) > taxAdjForRow(peakRow)) peakRow = r;
  }

  // Portfolio at end
  const lastRow       = rows[rows.length - 1];
  const portfolioEnd  = useReal
    ? lastRow.totalPortfolio * lastRow.realDeflator
    : lastRow.totalPortfolio;

  return { totalTax, avgEffRate, ssEffRate, ssYearRange, peakRow, portfolioEnd };
}

// ---------------------------------------------------------------------------
// HTML generation
// ---------------------------------------------------------------------------

function tilesHtml(m, rows, viewPerson) {
  const pct  = v => (v * 100).toFixed(1) + '%';
  const curr = v => '£' + Math.round(v).toLocaleString('en-GB');

  const peakTax = m.peakRow
    ? (viewPerson === 'woody' ? m.peakRow.woodyTax
     : viewPerson === 'heidi' ? m.peakRow.heidiTax
     : m.peakRow.woodyTax + m.peakRow.heidiTax)
    : 0;

  const ssHtml = m.ssEffRate !== null
    ? `${pct(m.ssEffRate)}<span class="tile-sub" title="Years ${m.ssYearRange}">${m.ssYearRange}</span>`
    : '<span class="tile-na">No SP years in projection</span>';

  return `
    <div class="metric-tile">
      <div class="tile-label">Total tax paid</div>
      <div class="tile-value">${curr(m.totalTax)}</div>
    </div>
    <div class="metric-tile">
      <div class="tile-label">Avg effective rate</div>
      <div class="tile-value">${pct(m.avgEffRate)}</div>
      <div class="tile-sub">all ${rows.length} years</div>
    </div>
    <div class="metric-tile">
      <div class="tile-label">Steady-state rate</div>
      <div class="tile-value">${ssHtml}</div>
    </div>
    <div class="metric-tile">
      <div class="tile-label">Peak tax year</div>
      <div class="tile-value">${m.peakRow ? m.peakRow.year : '—'}</div>
      <div class="tile-sub">${curr(peakTax)}</div>
    </div>
    <div class="metric-tile">
      <div class="tile-label">Portfolio at end</div>
      <div class="tile-value">${curr(m.portfolioEnd)}</div>
      <div class="tile-sub">${rows[rows.length - 1]?.year ?? ''}</div>
    </div>
  `;
}
