/**
 * scenarios.js
 *
 * UI-facing scenario management.
 * Renders the scenario switcher, handles save/load/rename/delete actions,
 * and wires up the worker to run projections when inputs change.
 *
 * Depends on: state.js, inputs.js, worker.js (via app.js orchestration)
 * No direct DOM queries outside of the functions below.
 */

'use strict';

import {
  listScenarios,
  createScenario,
  switchScenario,
  renameScenario,
  deleteScenario,
  getActiveScenarioId,
  subscribe,
} from './state.js';

// ---------------------------------------------------------------------------
// Scenario panel rendering
// ---------------------------------------------------------------------------

/**
 * Render the scenario list into the given container element.
 * Called on init and whenever state changes.
 *
 * @param {HTMLElement} container
 */
export function renderScenarioList(container) {
  if (!container) return;

  const scenarios    = listScenarios();
  const activeId     = getActiveScenarioId();

  container.innerHTML = '';

  if (scenarios.length === 0) {
    container.insertAdjacentHTML('beforeend',
      '<p class="scenarios-empty">No saved scenarios.</p>'
    );
    return;
  }

  for (const s of scenarios) {
    const isActive = s.id === activeId;
    const item = document.createElement('div');
    item.className = 'scenario-item' + (isActive ? ' scenario-item--active' : '');
    item.dataset.id = s.id;

    item.innerHTML = `
      <span class="scenario-name">${escHtml(s.name)}</span>
      <span class="scenario-date">${formatDate(s.createdAt)}</span>
      <div class="scenario-actions">
        <button class="btn-scenario-load"  data-id="${s.id}" title="Load">Load</button>
        <button class="btn-scenario-rename" data-id="${s.id}" title="Rename">Rename</button>
        <button class="btn-scenario-delete" data-id="${s.id}" title="Delete">Delete</button>
      </div>
    `;
    container.appendChild(item);
  }
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

/**
 * Attach scenario panel event listeners.
 * Call once on app init.
 *
 * @param {HTMLElement} container       The scenario list container
 * @param {HTMLElement} saveBtn         "Save scenario" button
 * @param {HTMLElement} nameInput       Scenario name text input
 * @param {() => import('./inputs.js').ProjectionInputs} readInputsFn
 *   Callback that reads current inputs from the sidebar DOM.
 * @param {(id: string) => void} onSwitch
 *   Callback invoked after switching scenario (e.g. to reload sidebar + rerun).
 */
export function wireScenarioPanel(container, saveBtn, nameInput, readInputsFn, onSwitch) {
  // Save new scenario
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const name   = nameInput?.value.trim() || `Scenario ${listScenarios().length + 1}`;
      const inputs = readInputsFn();
      createScenario(name, inputs);
      if (nameInput) nameInput.value = '';
    });
  }

  // Load / rename / delete via event delegation on container
  if (container) {
    container.addEventListener('click', e => {
      const btn = e.target.closest('button[data-id]');
      if (!btn) return;
      const id = btn.dataset.id;

      if (btn.classList.contains('btn-scenario-load')) {
        switchScenario(id);
        onSwitch(id);
      }

      if (btn.classList.contains('btn-scenario-rename')) {
        const newName = prompt('New name:', listScenarios().find(s => s.id === id)?.name || '');
        if (newName?.trim()) renameScenario(id, newName.trim());
      }

      if (btn.classList.contains('btn-scenario-delete')) {
        if (confirm('Delete this scenario?')) deleteScenario(id);
      }
    });
  }

  // Re-render whenever state changes
  subscribe(() => renderScenarioList(container));
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Escape HTML special characters.
 * @param {string} str
 * @returns {string}
 */
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Format an ISO 8601 date string as a short locale date.
 * @param {string} iso
 * @returns {string}
 */
function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}
