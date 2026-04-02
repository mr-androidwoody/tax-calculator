export function renderResults({ peopleResults, householdResult }) {
  renderHousehold(householdResult);
  renderPerson('woody', peopleResults[0]);
  renderPerson('heidi', peopleResults[1]);
  renderRaw({ peopleResults, householdResult });
}

// --------------------
// Household
// --------------------

function renderHousehold(result) {
  const el = document.getElementById('householdSummaryMetrics');
  if (!el || !result) return;

  el.innerHTML = `
    <div class="metric-row"><dt>Gross cash income</dt><dd>${fmt(result?.totals?.grossCashIncome)}</dd></div>
    <div class="metric-row"><dt>Income tax</dt><dd>${fmt(result?.totals?.incomeTax)}</dd></div>
    <div class="metric-row"><dt>Capital gains tax</dt><dd>${fmt(result?.totals?.capitalGainsTax)}</dd></div>
    <div class="metric-row"><dt>Total tax</dt><dd>${fmt(result?.totals?.totalTax)}</dd></div>
    <div class="metric-row"><dt>Net after all tax</dt><dd>${fmt(result?.totals?.netAfterAllTax)}</dd></div>
  `;
}

// --------------------
// Person
// --------------------

function renderPerson(id, person) {
  if (!person) return;

  renderIncomeSummary(id, person);
  renderTaxSummary(id, person);
}

// Keep this minimal for now
function renderIncomeSummary(id, person) {
  const el = document.getElementById(`${id}IncomeSummary`);
  if (!el) return;

  const income = person?.income || {};

  const nonSavings =
    (income.statePension || 0) +
    (income.dbPension || 0) +
    (income.pensionDrawdown || 0) +
    (income.employment || 0) +
    (income.selfEmployment || 0) +
    (income.otherTaxable || 0);

  const savings =
    (income.qmmfInterest || 0) +
    (income.cashInterest || 0) +
    (income.otherSavings || 0);

  el.innerHTML = `
    <div class="metric-row"><dt>Non-savings income</dt><dd>${fmt(nonSavings)}</dd></div>
    <div class="metric-row"><dt>Savings income</dt><dd>${fmt(savings)}</dd></div>
    <div class="metric-row"><dt>Dividends</dt><dd>${fmt(income.dividends)}</dd></div>
    <div class="metric-row"><dt>Capital gains</dt><dd>${fmt(income.taxableGains)}</dd></div>
  `;
}

function renderTaxSummary(id, person) {
  const el = document.getElementById(`${id}TaxSummary`);
  if (!el) return;

  const tax = person?.tax?.totals || {};

  el.innerHTML = `
    <div class="metric-row"><dt>Income tax</dt><dd>${fmt(tax.incomeTax)}</dd></div>
    <div class="metric-row"><dt>CGT</dt><dd>${fmt(tax.capitalGainsTax)}</dd></div>
    <div class="metric-row"><dt>Total tax</dt><dd>${fmt(tax.totalTax)}</dd></div>
  `;
}

// --------------------
// Raw JSON
// --------------------

function renderRaw(data) {
  const el = document.getElementById('rawJsonOutput');
  if (!el) return;

  el.textContent = JSON.stringify(data, null, 2);
}

// --------------------
// Formatter
// --------------------

function fmt(value) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(value || 0);
}