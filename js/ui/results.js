export function renderResults({ peopleResults = [], householdResult = null } = {}) {
  renderHousehold(householdResult);
  renderPerson('woody', peopleResults[0] || null);
  renderPerson('heidi', peopleResults[1] || null);
  renderRaw({ peopleResults, householdResult });
}

function renderHousehold(result) {
  const el = document.getElementById('householdSummaryMetrics');
  if (!el) return;

  const household = result?.household || {};
  const taxPaid = household?.taxPaid || {};

  el.innerHTML = `
    <div class="metric-row"><dt>Gross cash income</dt><dd>${fmtCurrency(household.grossCashIncome)}</dd></div>
    <div class="metric-row"><dt>Income tax</dt><dd>${fmtCurrency(taxPaid.incomeTax)}</dd></div>
    <div class="metric-row"><dt>Capital gains tax</dt><dd>${fmtCurrency(taxPaid.capitalGainsTax)}</dd></div>
    <div class="metric-row"><dt>Total tax</dt><dd>${fmtCurrency(taxPaid.totalTax)}</dd></div>
    <div class="metric-row"><dt>Net after all tax</dt><dd>${fmtCurrency(household.netAfterAllTax)}</dd></div>
  `;
}

function renderPerson(id, person) {
  renderIncomeSummary(id, person);
  renderAllowances(id, person);
  renderTaxSummary(id, person);
  renderOutcomeSummary(id, person);
}

function renderIncomeSummary(id, person) {
  const el = document.getElementById(`${id}IncomeSummary`);
  if (!el) return;

  const grossIncome = person?.tax?.totals?.grossIncome || {};

  el.innerHTML = `
    <div class="metric-row"><dt>Non-savings income</dt><dd>${fmtCurrency(grossIncome.nonSavings)}</dd></div>
    <div class="metric-row"><dt>Savings income</dt><dd>${fmtCurrency(grossIncome.savings)}</dd></div>
    <div class="metric-row"><dt>Dividends</dt><dd>${fmtCurrency(grossIncome.dividends)}</dd></div>
    <div class="metric-row"><dt>Capital gains</dt><dd>${fmtCurrency(grossIncome.capitalGains)}</dd></div>
  `;
}

function renderAllowances(id, person) {
  const el = document.getElementById(`${id}Allowances`);
  if (!el) return;

  const allowances = person?.tax?.allowances || {};
  const startingRate = allowances?.startingRateForSavings || {};
  const psa = allowances?.personalSavingsAllowance || {};
  const dividendAllowance = allowances?.dividendAllowance || {};

  el.innerHTML = `
    <div class="metric-row"><dt>Personal allowance</dt><dd>${fmtCurrency(allowances.personalAllowance)}</dd></div>
    <div class="metric-row"><dt>Starting rate used</dt><dd>${fmtCurrency(startingRate.used)}</dd></div>
    <div class="metric-row"><dt>PSA used</dt><dd>${fmtCurrency(psa.used)}</dd></div>
    <div class="metric-row"><dt>Dividend allowance used</dt><dd>${fmtCurrency(dividendAllowance.used)}</dd></div>
  `;
}

function renderTaxSummary(id, person) {
  const el = document.getElementById(`${id}TaxSummary`);
  if (!el) return;

  const taxTotals = person?.tax?.taxTotals || {};

  el.innerHTML = `
    <div class="metric-row"><dt>Income tax</dt><dd>${fmtCurrency(taxTotals.incomeTax)}</dd></div>
    <div class="metric-row"><dt>CGT</dt><dd>${fmtCurrency(taxTotals.capitalGainsTax)}</dd></div>
    <div class="metric-row"><dt>Total tax</dt><dd>${fmtCurrency(taxTotals.totalTax)}</dd></div>
  `;
}

function renderOutcomeSummary(id, person) {
  const el = document.getElementById(`${id}OutcomeSummary`);
  if (!el) return;

  const net = person?.tax?.netIncomeAfterTax || {};
  const bandSummary = person?.tax?.bandSummary || {};

  el.innerHTML = `
    <div class="metric-row"><dt>Net after income tax</dt><dd>${fmtCurrency(net.afterIncomeTax)}</dd></div>
    <div class="metric-row"><dt>Net after all tax</dt><dd>${fmtCurrency(net.afterAllTax)}</dd></div>
    <div class="metric-row"><dt>Marginal band</dt><dd>${fmtBand(bandSummary.marginalIncomeBand)}</dd></div>
  `;
}

function renderRaw(data) {
  const el = document.getElementById('rawJsonOutput');
  if (!el) return;

  el.textContent = JSON.stringify(data, null, 2);
}

function fmtCurrency(value) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(toNumber(value));
}

function fmtBand(value) {
  const band = String(value || 'none');
  if (band === 'none') return 'None';
  return band.charAt(0).toUpperCase() + band.slice(1);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}