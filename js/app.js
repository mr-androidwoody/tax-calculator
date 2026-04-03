import { getHouseholdInput } from './ui/form.js';
import { runPlanner } from './planner/plan-runner.js';
import { renderResults } from './ui/results.js';

const runBtn = document.getElementById('runCalculationBtn');
const sampleBtn = document.getElementById('loadSampleBtn');
const toggleBtn = document.getElementById('toggleRawJsonBtn');

if (runBtn) {
  runBtn.addEventListener('click', () => {
    const input = getHouseholdInput();
    const result = runPlanner(input);
    renderResults({
      peopleResults: result.tax.peopleResults,
      householdResult: result.tax.householdResult,
      planner: result.planner
    });
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
  // Existing income — planner drives pension drawdown, so leave at 0
  setValue('woodyPensionDrawdown', 0);
  setValue('woodyQmmfInterest', 8000);
  setValue('woodyDividends', 3000);
  setValue('woodyTaxableGains', 0);

  setValue('heidiEmployment', 15000);
  setValue('heidiCashInterest', 2000);
  setValue('heidiDividends', 0);
  setValue('heidiTaxableGains', 0);

  // Planner targets
  setValue('woodyNetIncomeTarget', 45000);
  setValue('heidiNetIncomeTarget', 20000);

  // Asset balances
  setValue('woodyAssetCash', 577000);
  setValue('woodyAssetPension', 481000);
  setValue('woodyAssetGia', 154000);
  setValue('woodyAssetIsa', 274000);

  setValue('heidiAssetCash', 100);
  setValue('heidiAssetPension', 202000);
  setValue('heidiAssetGia', 6000);
  setValue('heidiAssetIsa', 144000);
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.value = String(value);
  }
}
