import TAX_POLICY_2026_27 from '../tax/policy.js';
import { calculateAnnualTax } from '../tax/annual-tax.js';
import { calculateHouseholdTax } from '../tax/household-tax.js';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

function buildAnnualScenarioResults() {
  const scenarios = [
    {
      id: 'scenario_1',
      label: 'No taxable income',
      income: {}
    },
    {
      id: 'scenario_2',
      label: 'Interest only within Personal Allowance',
      income: {
        qmmfInterest: 10_000
      }
    },
    {
      id: 'scenario_3',
      label: 'State pension plus QMMF interest',
      income: {
        statePension: 11_500,
        qmmfInterest: 6_000
      }
    },
    {
      id: 'scenario_4',
      label: 'Pension drawdown to Personal Allowance',
      income: {
        pensionDrawdown: 12_570
      }
    },
    {
      id: 'scenario_5',
      label: 'Pension drawdown into basic rate',
      income: {
        pensionDrawdown: 35_000
      }
    },
    {
      id: 'scenario_6',
      label: 'Higher-rate mix: pension + interest',
      income: {
        pensionDrawdown: 45_000,
        qmmfInterest: 12_000
      }
    },
    {
      id: 'scenario_7',
      label: 'Dividends added on top',
      income: {
        pensionDrawdown: 35_000,
        qmmfInterest: 5_000,
        dividends: 6_000
      }
    },
    {
      id: 'scenario_8',
      label: 'Personal Allowance taper zone',
      income: {
        pensionDrawdown: 110_000
      }
    },
    {
      id: 'scenario_9',
      label: 'Additional rate zone',
      income: {
        pensionDrawdown: 140_000
      }
    },
    {
      id: 'scenario_10',
      label: 'Manual capital gains included',
      income: {
        pensionDrawdown: 20_000,
        qmmfInterest: 2_000,
        taxableGains: 10_000
      }
    }
  ];

  return scenarios.map((scenario) => {
    const result = calculateAnnualTax(scenario.income, TAX_POLICY_2026_27);

    return {
      label: scenario.label,
      input: scenario.income,
      result
    };
  });
}

function buildHouseholdScenarioResult() {
  return calculateHouseholdTax(
    {
      people: [
        {
          id: 'p1',
          name: 'Person 1',
          income: {
            statePension: 11_500,
            pensionDrawdown: 20_000,
            qmmfInterest: 4_000
          }
        },
        {
          id: 'p2',
          name: 'Person 2',
          income: {
            dbPension: 8_000,
            qmmfInterest: 7_500,
            dividends: 2_000
          }
        }
      ]
    },
    TAX_POLICY_2026_27
  );
}

function renderResults() {
  const outputEl = document.getElementById('output');
  if (!outputEl) return;

  const annualResults = buildAnnualScenarioResults();
  const householdResult = buildHouseholdScenarioResult();

  const lines = [];

  lines.push(`Tax policy: ${TAX_POLICY_2026_27.taxYear}`);
  lines.push('');

  lines.push('=== ANNUAL TAX SCENARIOS ===');
  lines.push('');

  annualResults.forEach((scenario, index) => {
    const r = scenario.result;

    lines.push(`${index + 1}. ${scenario.label}`);
    lines.push(`   Input: ${JSON.stringify(scenario.input)}`);
    lines.push(`   Personal Allowance: ${formatCurrency(r.allowances.personalAllowance)}`);
    lines.push(`   Income Tax: ${formatCurrency(r.taxTotals.incomeTax)}`);
    lines.push(`   CGT: ${formatCurrency(r.taxTotals.capitalGainsTax)}`);
    lines.push(`   Total Tax: ${formatCurrency(r.taxTotals.totalTax)}`);
    lines.push(`   Net Income: ${formatCurrency(r.netIncomeAfterTax.afterAllTax)}`);
    lines.push(`   Band: ${r.bandSummary.marginalIncomeBand}`);
    lines.push('');
  });

  lines.push('=== HOUSEHOLD SCENARIO ===');
  lines.push('');

  lines.push(`Total Tax: ${formatCurrency(householdResult.household.taxPaid.totalTax)}`);
  lines.push(`Net After Tax: ${formatCurrency(householdResult.household.netAfterAllTax)}`);
  lines.push(`Higher Rate People: ${householdResult.household.bandSummary.peopleWithHigherRateIncome}`);
  lines.push('');

  outputEl.textContent = lines.join('\n');

  console.group('Annual scenarios');
  annualResults.forEach(s => console.log(s.label, s.result));
  console.groupEnd();

  console.group('Household');
  console.log(householdResult);
  console.groupEnd();
}

// Wire button
const btn = document.getElementById('runTestsBtn');

if (btn) {
  btn.addEventListener('click', renderResults);
}

// Run on load
renderResults();