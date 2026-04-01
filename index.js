import TAX_POLICY_2026_27 from 'tax/policy.js';
import { calculateAnnualTax } from 'tax/annual-tax.js';
import { calculateHouseholdTax } from 'tax/household-tax.js';

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
      label: 'Manual capital gains included passively',
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
      id: scenario.id,
      label: scenario.label,
      input: scenario.income,
      keyFigures: {
        adjustedNetIncome: result.allowances.adjustedNetIncome,
        personalAllowance: result.allowances.personalAllowance,
        incomeTax: result.taxTotals.incomeTax,
        capitalGainsTax: result.taxTotals.capitalGainsTax,
        totalTax: result.taxTotals.totalTax,
        grossCashIncome: result.netIncomeAfterTax.grossCashIncome,
        netAfterAllTax: result.netIncomeAfterTax.afterAllTax,
        marginalIncomeBand: result.bandSummary.marginalIncomeBand,
        hasHigherRateIncome: result.bandSummary.hasHigherRateIncome,
        hasAdditionalRateIncome: result.bandSummary.hasAdditionalRateIncome
      },
      fullResult: result
    };
  });
}

function buildHouseholdScenarioResult() {
  const household = {
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
  };

  return calculateHouseholdTax(household, TAX_POLICY_2026_27);
}

function renderResults() {
  const outputEl = document.getElementById('output');
  if (!outputEl) return;

  const annualResults = buildAnnualScenarioResults();
  const householdResult = buildHouseholdScenarioResult();

  const lines = [];

  lines.push(`Tax policy: ${TAX_POLICY_2026_27.taxYear} (${TAX_POLICY_2026_27.region})`);
  lines.push('');

  lines.push('=== ANNUAL TAX SCENARIOS ===');
  lines.push('');

  annualResults.forEach((scenario, index) => {
    lines.push(`${index + 1}. ${scenario.label}`);
    lines.push(`   Input: ${JSON.stringify(scenario.input)}`);
    lines.push(`   Adjusted net income: ${formatCurrency(scenario.keyFigures.adjustedNetIncome)}`);
    lines.push(`   Personal Allowance: ${formatCurrency(scenario.keyFigures.personalAllowance)}`);
    lines.push(`   Income tax: ${formatCurrency(scenario.keyFigures.incomeTax)}`);
    lines.push(`   Capital gains tax: ${formatCurrency(scenario.keyFigures.capitalGainsTax)}`);
    lines.push(`   Total tax: ${formatCurrency(scenario.keyFigures.totalTax)}`);
    lines.push(`   Gross cash income: ${formatCurrency(scenario.keyFigures.grossCashIncome)}`);
    lines.push(`   Net after all tax: ${formatCurrency(scenario.keyFigures.netAfterAllTax)}`);
    lines.push(`   Marginal band: ${scenario.keyFigures.marginalIncomeBand}`);
    lines.push(`   Higher-rate income: ${scenario.keyFigures.hasHigherRateIncome}`);
    lines.push(`   Additional-rate income: ${scenario.keyFigures.hasAdditionalRateIncome}`);
    lines.push('');
  });

  lines.push('=== HOUSEHOLD TAX SCENARIO ===');
  lines.push('');
  lines.push(`Household gross cash income: ${formatCurrency(householdResult.household.grossCashIncome)}`);
  lines.push(`Household net after income tax: ${formatCurrency(householdResult.household.netAfterIncomeTax)}`);
  lines.push(`Household net after all tax: ${formatCurrency(householdResult.household.netAfterAllTax)}`);
  lines.push(`Household income tax: ${formatCurrency(householdResult.household.taxPaid.incomeTax)}`);
  lines.push(`Household capital gains tax: ${formatCurrency(householdResult.household.taxPaid.capitalGainsTax)}`);
  lines.push(`Household total tax: ${formatCurrency(householdResult.household.taxPaid.totalTax)}`);
  lines.push(`People with higher-rate income: ${householdResult.household.bandSummary.peopleWithHigherRateIncome}`);
  lines.push(`People with additional-rate income: ${householdResult.household.bandSummary.peopleWithAdditionalRateIncome}`);
  lines.push('');
  lines.push('Per-person household results:');
  lines.push(JSON.stringify(householdResult.people, null, 2));

  outputEl.textContent = lines.join('\n');

  console.group('Annual tax scenarios');
  annualResults.forEach((scenario) => {
    console.log(scenario.label, scenario.fullResult);
  });
  console.groupEnd();

  console.group('Household scenario');
  console.log(householdResult);
  console.groupEnd();
}

const runTestsBtn = document.getElementById('runTestsBtn');

if (runTestsBtn) {
  runTestsBtn.addEventListener('click', renderResults);
}

renderResults();