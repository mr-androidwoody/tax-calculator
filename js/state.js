/**
 * state.js
 *
 * Central application state and scenario store.
 * Scenarios are persisted to localStorage under key 'rtc_scenarios'.
 *
 * All mutations go through the exported functions — no direct property writes
 * from other modules. This keeps the state surface narrow and auditable.
 *
 * No DOM access. UI modules import state and call setters; they observe
 * changes via the subscribe() mechanism.
 */

'use strict';

// ---------------------------------------------------------------------------
// View state (ephemeral — not persisted)
// ---------------------------------------------------------------------------

/** @type {'both'|'woody'|'heidi'} */
let _viewPerson = 'both';

/** @type {boolean} */
let _useReal = false;

/** @type {string|null} Active scenario ID */
let _activeScenarioId = null;

// ---------------------------------------------------------------------------
// Scenario store
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'rtc_scenarios';

/**
 * @typedef {Object} Scenario
 * @property {string}   id
 * @property {string}   name
 * @property {string}   createdAt   ISO 8601
 * @property {import('./inputs.js').ProjectionInputs} inputs
 * @property {import('./projection-engine.js').ProjectionRow[]|null} rows  null if not yet run
 */

/**
 * Load scenarios from localStorage.
 * Returns an empty object if storage is missing or corrupt.
 *
 * @returns {{ [id: string]: Scenario }}
 */
function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Persist the store to localStorage.
 * @param {{ [id: string]: Scenario }} store
 */
function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn('state: localStorage write failed', err);
  }
}

// ---------------------------------------------------------------------------
// Subscribers
// ---------------------------------------------------------------------------

/** @type {Set<() => void>} */
const _subscribers = new Set();

/**
 * Register a callback to be called whenever state changes.
 * Returns an unsubscribe function.
 *
 * @param {() => void} fn
 * @returns {() => void}
 */
export function subscribe(fn) {
  _subscribers.add(fn);
  return () => _subscribers.delete(fn);
}

function notify() {
  for (const fn of _subscribers) fn();
}

// ---------------------------------------------------------------------------
// View state accessors
// ---------------------------------------------------------------------------

/** @returns {'both'|'woody'|'heidi'} */
export function getViewPerson() { return _viewPerson; }

/**
 * @param {'both'|'woody'|'heidi'} person
 */
export function setViewPerson(person) {
  if (_viewPerson === person) return;
  _viewPerson = person;
  notify();
}

/** @returns {boolean} */
export function getUseReal() { return _useReal; }

/** @param {boolean} val */
export function setUseReal(val) {
  if (_useReal === val) return;
  _useReal = val;
  notify();
}

// ---------------------------------------------------------------------------
// Active scenario
// ---------------------------------------------------------------------------

/** @returns {string|null} */
export function getActiveScenarioId() { return _activeScenarioId; }

/**
 * Return the currently active scenario, or null.
 * @returns {Scenario|null}
 */
export function getActiveScenario() {
  if (!_activeScenarioId) return null;
  return loadStore()[_activeScenarioId] ?? null;
}

/**
 * Return the rows for the active scenario, or null if not yet run.
 * @returns {import('./projection-engine.js').ProjectionRow[]|null}
 */
export function getActiveRows() {
  return getActiveScenario()?.rows ?? null;
}

// ---------------------------------------------------------------------------
// Scenario CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new scenario and make it active.
 *
 * @param {string} name
 * @param {import('./inputs.js').ProjectionInputs} inputs
 * @returns {string} The new scenario ID
 */
export function createScenario(name, inputs) {
  const id    = `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const store = loadStore();
  store[id]   = { id, name, createdAt: new Date().toISOString(), inputs, rows: null };
  saveStore(store);
  _activeScenarioId = id;
  notify();
  return id;
}

/**
 * Update the inputs for an existing scenario and clear its cached rows.
 *
 * @param {string} id
 * @param {import('./inputs.js').ProjectionInputs} inputs
 */
export function updateScenarioInputs(id, inputs) {
  const store = loadStore();
  if (!store[id]) return;
  store[id] = { ...store[id], inputs, rows: null };
  saveStore(store);
  notify();
}

/**
 * Store projection results against a scenario.
 *
 * @param {string} id
 * @param {import('./projection-engine.js').ProjectionRow[]} rows
 */
export function storeScenarioResults(id, rows) {
  const store = loadStore();
  if (!store[id]) return;
  store[id] = { ...store[id], rows };
  saveStore(store);
  if (id === _activeScenarioId) notify();
}

/**
 * Switch the active scenario.
 *
 * @param {string} id
 */
export function switchScenario(id) {
  const store = loadStore();
  if (!store[id]) return;
  _activeScenarioId = id;
  notify();
}

/**
 * Rename a scenario.
 *
 * @param {string} id
 * @param {string} name
 */
export function renameScenario(id, name) {
  const store = loadStore();
  if (!store[id]) return;
  store[id] = { ...store[id], name };
  saveStore(store);
  notify();
}

/**
 * Delete a scenario. If it was active, active ID is cleared.
 *
 * @param {string} id
 */
export function deleteScenario(id) {
  const store = loadStore();
  delete store[id];
  saveStore(store);
  if (_activeScenarioId === id) _activeScenarioId = null;
  notify();
}

/**
 * Return all scenarios as an array, sorted by createdAt ascending.
 *
 * @returns {Scenario[]}
 */
export function listScenarios() {
  const store = loadStore();
  return Object.values(store).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
