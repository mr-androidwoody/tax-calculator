/**
 * render-tables.js
 *
 * Renders the tax breakdown table and the asset values table.
 *
 * Tax table columns:
 *   Year | Ages | Spending target | Woody IT | Woody CGT | B&ISA CGT |
 *   Heidi IT | Heidi CGT | Total tax | Cumulative tax | Eff. rate
 *
 * Asset table columns:
 *   Year | Ages | Woody Cash | Woody QMMF | Woody GIA | Woody SIPP | Woody ISA |
 *   Heidi Cash | Heidi GIA | Heidi SIPP | Heidi ISA | Total (£k + bar)
 *
 * Depends on: state.js
 */

'use strict';

import { getViewPerson, getUseReal, getActiveRows } from './state.js';

// ---------------------------------------------------------------------------
// Tax table
// ---------------------------------------------------------------------------

/**
 * Render the tax breakdown table.
 *
 * @param {HTMLElement} tbody
 * @param {HTMLElement} tfoot
 */
export function renderTaxTable(tbody, tfoot) {
  const rows       = getActiveRows();
  const viewPerson = getViewPerson();
  const useReal    = getUseReal();

  if (!tbody) return;
  tbody.innerHTML = '';
  if (tfoot) tfoot.innerHTML = '';
  if (!rows || rows.length === 0) return;

  const adj = (val, row) => useReal ? val * row.realDeflator : val;

  let cumTax = 0;

  for (const r of rows) {
    const woodyIT  = adj(r.woodyIncomeTax, r);
    const woodyCGT = adj(r.woodyCGT, r);
    const bniCGT   = adj(r.bniCGTBill,   r);
    const heidiIT  = adj(r.heidiIncomeTax, r);
    const heidiCGT = adj(r.heidiCGT, r);
    const spending = adj(r.spendingTarget, r);

    const totalTax = (viewPerson === 'woody') ? woodyIT + woodyCGT
                   : (viewPerson === 'heidi') ? heidiIT + heidiCGT
                   : woodyIT + woodyCGT + bniCGT + heidiIT + heidiCGT;

    cumTax += totalTax;
    const effRate = spending > 0 ? totalTax / spending : 0;

    const stepLabel = r.spendingMultiplier < 1
      ? ` <span class="step-badge">×${r.spendingMultiplier.toFixed(2)}</span>`
      : '';

    const spClass  = r.woodySP > 0 && r.heidiSP > 0 ? ' class="post-sp"' : '';

    tbody.insertAdjacentHTML('beforeend', `
      <tr${spClass}>
        <td>${r.year}</td>
        <td>${r.woodyAge} / ${r.heidiAge}</td>
        <td class="num">${f(spending)}${stepLabel}</td>
        ${viewPerson !== 'heidi' ? `<td class="num">${f(woodyIT)}</td><td class="num">${f(woodyCGT)}</td>` : ''}
        ${viewPerson === 'both'  ? `<td class="num">${f(bniCGT)}</td>` : ''}
        ${viewPerson !== 'woody' ? `<td class="num">${f(heidiIT)}</td><td class="num">${f(heidiCGT)}</td>` : ''}
        <td class="num total-col">${f(totalTax)}</td>
        <td class="num">${f(cumTax)}</td>
        <td class="num">${(effRate * 100).toFixed(1)}%</td>
      </tr>
    `);
  }

  // Footer totals
  if (tfoot) {
    const totals = rows.reduce((acc, r) => {
      const a = v => useReal ? v * r.realDeflator : v;
      acc.woodyIT  += a(r.woodyIncomeTax);
      acc.woodyCGT += a(r.woodyCGT);
      acc.bniCGT   += a(r.bniCGTBill);
      acc.heidiIT  += a(r.heidiIncomeTax);
      acc.heidiCGT += a(r.heidiCGT);
      return acc;
    }, { woodyIT: 0, woodyCGT: 0, bniCGT: 0, heidiIT: 0, heidiCGT: 0 });

    const grand = viewPerson === 'woody' ? totals.woodyIT + totals.woodyCGT
                : viewPerson === 'heidi' ? totals.heidiIT + totals.heidiCGT
                : totals.woodyIT + totals.woodyCGT + totals.bniCGT + totals.heidiIT + totals.heidiCGT;

    tfoot.insertAdjacentHTML('beforeend', `
      <tr class="totals-row">
        <td colspan="3"><strong>Total</strong></td>
        ${viewPerson !== 'heidi' ? `<td class="num">${f(totals.woodyIT)}</td><td class="num">${f(totals.woodyCGT)}</td>` : ''}
        ${viewPerson === 'both'  ? `<td class="num">${f(totals.bniCGT)}</td>` : ''}
        ${viewPerson !== 'woody' ? `<td class="num">${f(totals.heidiIT)}</td><td class="num">${f(totals.heidiCGT)}</td>` : ''}
        <td class="num total-col">${f(grand)}</td>
        <td class="num">${f(cumTax)}</td>
        <td></td>
      </tr>
    `);
  }
}

// ---------------------------------------------------------------------------
// Asset table
// ---------------------------------------------------------------------------

/**
 * Render the asset values table.
 *
 * @param {HTMLElement} tbody
 */
export function renderAssetTable(tbody) {
  const rows    = getActiveRows();
  const useReal = getUseReal();

  if (!tbody) return;
  tbody.innerHTML = '';
  if (!rows || rows.length === 0) return;

  const maxPortfolio = Math.max(...rows.map(r =>
    useReal ? r.totalPortfolio * r.realDeflator : r.totalPortfolio
  ));

  for (const r of rows) {
    const a   = v => useReal ? v * r.realDeflator : v;
    const k   = v => (a(v) / 1000).toFixed(0);
    const tot = useReal ? r.totalPortfolio * r.realDeflator : r.totalPortfolio;
    const barPct = maxPortfolio > 0 ? (tot / maxPortfolio * 100).toFixed(1) : 0;

    const spClass = r.woodySP > 0 && r.heidiSP > 0 ? ' class="post-sp"' : '';

    tbody.insertAdjacentHTML('beforeend', `
      <tr${spClass}>
        <td>${r.year}</td>
        <td>${r.woodyAge} / ${r.heidiAge}</td>
        <td class="num wrap-cash">${k(r.snap.woodyCash)}</td>
        <td class="num wrap-qmmf">${k(r.snap.woodyQMMF)}</td>
        <td class="num wrap-gia">${k(r.snap.woodyGIA)}</td>
        <td class="num wrap-sipp">${k(r.snap.woodySIPP)}</td>
        <td class="num wrap-isa">${k(r.snap.woodyISA)}</td>
        <td class="num wrap-cash">${k(r.snap.heidiCash || 0)}</td>
        <td class="num wrap-gia">${k(r.snap.heidiGIA)}</td>
        <td class="num wrap-sipp">${k(r.snap.heidiSIPP)}</td>
        <td class="num wrap-isa">${k(r.snap.heidiISA)}</td>
        <td class="num total-col">
          ${(tot / 1000).toFixed(0)}k
          <span class="portfolio-bar" style="width:${barPct}%"></span>
        </td>
      </tr>
    `);
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Format a number as £ with thousands separator, rounded to nearest £. */
function f(n) {
  if (!n && n !== 0) return '—';
  const rounded = Math.round(n);
  if (rounded === 0) return '—';
  return '£' + rounded.toLocaleString('en-GB');
}
