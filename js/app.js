import { getHouseholdInput } from './ui/form.js';
import { runPlanner } from './planner/planner-runner.js';
import { renderResults } from './ui/results.js';

const runBtn = document.getElementById('runCalculationBtn');
const sampleBtn = document.getElementById('loadSampleBtn');
const toggleBtn = document.getElementById('toggleRawJsonBtn');

if (runBtn) {
  runBtn.addEventListener('click', () => {
    const input = getHouseholdInput();
    const result = runPlanner(input);
    renderResults(result);
  });
}

if (sampleBtn) {
  sampleBtn.addEventListener('click', () => {
    loadSampleCase();
  });
}

if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    const panel = document.getElementById('rawJsonPanel');
    if (!panel) return;

    const isHidden = panel.classList.toggle('hidden');
    toggleBtn.setAttribute('aria-expanded', String(!isHidden));
  });
}

function loadSampleCase() {
  setValue('woodyPensionDrawdown', 40000);
  setValue('woodyQmmfInterest', 8000);
  setValue('woodyDividends', 3000);
  setValue('woodyTaxableGains', 0);

  setValue('heidiEmployment', 15000);
  setValue('heidiCashInterest', 2000);
  setValue('heidiDividends', 0);
  setValue('heidiTaxableGains', 0);
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.value = String(value);
  }
}