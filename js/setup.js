/**
 * setup.js
 *
 * Portfolio setup page logic.
 * Manages the accounts table on #setup-page and the transition to #main-app.
 *
 * Account objects follow the shape in constants.js (PRELOAD_ACCOUNTS).
 * The accounts array is exported so app.js can pass it into readInputs().
 */

'use strict';

import { PRELOAD_ACCOUNTS, WRAPPERS, FIXED_CASH_WRAPPERS } from './constants.js';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/**
 * Live array of account objects. Mutated by add/edit/delete actions.
 * @type {import('./constants.js').AccountPreload[]}
 */
export let portfolioAccounts = [];

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/**
 * Initialise the setup page.
 * Loads preload accounts, renders the table, wires buttons.
 * Call once on DOMContentLoaded.
 *
 * @param {HTMLElement} setupPage     #setup-page element
 * @param {HTMLElement} mainApp       #main-app element
 * @param {HTMLElement} tableBody     tbody of the accounts table
 * @param {HTMLElement} addBtn        "Add account" button
 * @param {HTMLElement} continueBtn   "Continue" button
 * @param {() => void}  onContinue    Callback fired after transition to main app
 */
export function initSetup(setupPage, mainApp, tableBody, addBtn, continueBtn, onContinue) {
  // Load preload accounts as the starting point
  portfolioAccounts = PRELOAD_ACCOUNTS.map(a => ({ ...a, id: nextId() }));
  renderTable(tableBody);

  addBtn?.addEventListener('click', () => {
    portfolioAccounts.push(blankAccount());
    renderTable(tableBody);
  });

  const doContinue = () => {
    if (!validateAccounts()) return;
    setupPage.style.display = 'none';
    mainApp.style.display   = '';
    onContinue();
  };
  continueBtn?.addEventListener('click', doContinue);
  // Second continue button in the accounts toolbar
  document.getElementById('btn-continue-bottom')?.addEventListener('click', doContinue);
}

// ---------------------------------------------------------------------------
// Table rendering
// ---------------------------------------------------------------------------

/**
 * Re-render the accounts table body from portfolioAccounts.
 * @param {HTMLElement} tbody
 */
function renderTable(tbody) {
  if (!tbody) return;
  tbody.innerHTML = '';

  portfolioAccounts.forEach((acct, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.idx = idx;
    tr.innerHTML = `
      <td><input class="acct-name" value="${escHtml(acct.name)}" placeholder="e.g. Vanguard ISA"></td>
      <td>${wrapperSelect(acct.wrapper, idx)}</td>
      <td>${ownerSelect(acct.owner, idx)}</td>
      <td><input class="acct-value" type="number" min="0" step="1000" value="${acct.value}" data-idx="${idx}"></td>
      <td>${costOrRateCell(acct, idx)}</td>
      <td>${allocCell(acct, idx)}</td>
      <td><button class="btn-delete-acct" data-idx="${idx}" title="Remove">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  // Wire change events via delegation
  tbody.oninput  = e => handleInput(e, tbody);
  tbody.onchange = e => handleInput(e, tbody);
  tbody.onclick  = e => {
    const btn = e.target.closest('.btn-delete-acct');
    if (btn) {
      portfolioAccounts.splice(Number(btn.dataset.idx), 1);
      renderTable(tbody);
    }
  };
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

function handleInput(e, tbody) {
  const el  = e.target;
  const idx = Number(el.closest('tr')?.dataset.idx ?? el.dataset.idx);
  if (isNaN(idx) || !portfolioAccounts[idx]) return;
  const acct = portfolioAccounts[idx];

  if (el.classList.contains('acct-name'))    acct.name     = el.value;
  if (el.classList.contains('acct-value'))   acct.value    = parseFloat(el.value) || 0;
  if (el.classList.contains('acct-wrapper')) {
    acct.wrapper   = el.value;
    acct.costBasis = null;
    acct.rate      = null;
    // Re-render to show/hide optional columns
    renderTable(tbody);
  }
  if (el.classList.contains('acct-owner'))    acct.owner    = el.value;
  if (el.classList.contains('acct-cost'))     acct.costBasis = parseFloat(el.value) || null;
  if (el.classList.contains('acct-rate'))     acct.rate      = parseFloat(el.value) || null;
  if (el.classList.contains('acct-alloc')) {
    const key = el.dataset.alloc;
    acct.alloc[key] = parseFloat(el.value) || 0;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateAccounts() {
  if (portfolioAccounts.length === 0) {
    alert('Add at least one account before continuing.');
    return false;
  }
  for (const acct of portfolioAccounts) {
    const total = Object.values(acct.alloc).reduce((s, v) => s + v, 0);
    if (Math.abs(total - 100) > 0.5) {
      alert(`Account "${acct.name || '(unnamed)'}" allocation does not sum to 100% (got ${total}%).`);
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Cell helpers
// ---------------------------------------------------------------------------

function wrapperSelect(selected, idx) {
  const opts = WRAPPERS.map(w =>
    `<option value="${w}"${w === selected ? ' selected' : ''}>${w}</option>`
  ).join('');
  return `<select class="acct-wrapper" data-idx="${idx}">${opts}</select>`;
}

function ownerSelect(selected, idx) {
  return `<select class="acct-owner" data-idx="${idx}">
    <option value="Woody"${selected === 'Woody' ? ' selected' : ''}>Woody</option>
    <option value="Heidi"${selected === 'Heidi' ? ' selected' : ''}>Heidi</option>
  </select>`;
}

function costOrRateCell(acct, idx) {
  if (acct.wrapper === 'GIA') {
    const val = acct.costBasis ?? '';
    return `<input class="acct-cost" type="number" min="0" step="1000" value="${val}" data-idx="${idx}" placeholder="Cost basis">`;
  }
  if (acct.wrapper === 'QMMF') {
    const val = acct.rate ?? '';
    return `<input class="acct-rate" type="number" min="0" step="0.1" value="${val}" data-idx="${idx}" placeholder="Rate %">`;
  }
  return '<span class="acct-na">—</span>';
}

function allocCell(acct, idx) {
  if (FIXED_CASH_WRAPPERS.has(acct.wrapper)) {
    return '<span class="acct-na">Cash 100%</span>';
  }
  return `<div class="alloc-inline">
    <label>Eq<input class="acct-alloc" type="number" min="0" max="100" step="5" value="${acct.alloc.equities}" data-idx="${idx}" data-alloc="equities"></label>
    <label>Bd<input class="acct-alloc" type="number" min="0" max="100" step="5" value="${acct.alloc.bonds}"    data-idx="${idx}" data-alloc="bonds"></label>
    <label>Ca<input class="acct-alloc" type="number" min="0" max="100" step="5" value="${acct.alloc.cashlike}" data-idx="${idx}" data-alloc="cashlike"></label>
  </div>`;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

let _idCounter = 0;
function nextId() { return `acct_${++_idCounter}`; }

function blankAccount() {
  return {
    id: nextId(),
    name: '',
    wrapper: 'ISA',
    owner: 'Woody',
    value: 0,
    costBasis: null,
    rate: null,
    alloc: { equities: 100, bonds: 0, cashlike: 0, cash: 0 },
  };
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
