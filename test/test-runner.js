import TAX_POLICY_2026_27 from '../tax/policy.js';
import { calculateAnnualTax } from '../tax/annual-tax.js';
import { calculateHouseholdTax } from '../tax/household-tax.js';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(Number(value) || 0);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function appendLine(lines, text = '', indent = 0) {
  const prefix = indent > 0 ? ' '.repeat(indent) : '';
  lines.push(`${prefix}${text}`);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    return {
      pass: false,
      label,
      actual,
      expected,
      message: `FAIL: ${label} (actual: ${actual}, expected: ${expected})`
    };
  }

  return {
    pass: true,
    label,
    actual,
    expected,
    message: `PASS: ${label}`
  };
}

function assertClose(actual, expected, label, epsilon = 0.01) {
  if (Math.abs(toNumber(actual) - toNumber(expected)) > epsilon) {
    return {
      pass: false,
      label,
      actual,
      expected,
      message: `FAIL: ${label} (actual: ${actual}, expected: ${expected})`
    };
  }

  return {
    pass: true,
    label,
    actual,
    expected,
    message: `PASS: ${label}`
  };
}

function getAnnualResult(income) {
  return calculateAnnualTax(income, TAX_POLICY_2026_27);
}

function getHouseholdResult(people) {
  return calculateHouseholdTax({ people }, TAX_POLICY_2026_27);
}

function getPersonalAllowance(result) {
  return toNumber(result?.allowances?.personalAllowance);
}

function getIncomeTax(result) {
  return toNumber(result?.taxTotals?.incomeTax);
}

function getCapitalGainsTax(result) {
  return toNumber(result?.taxTotals?.capitalGainsTax);
}

function getTotalTax(result) {
  return toNumber(result?.taxTotals?.totalTax);
}

function getMarginalBand(result) {
  return String(result?.bandSummary?.marginalIncomeBand || 'none');
}

function logAssertion(assertion) {
  if (assertion.pass) {
    console.log(assertion.message);
  } else {
    console.error(assertion.message, {
      actual: assertion.actual,
      expected: assertion.expected,
      label: assertion.label
    });
  }
}

function runAssertions(assertions) {
  const results = assertions.map((assertion) => {
    logAssertion(assertion);
    return assertion;
  });

  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;

  return {
    passed,
    failed,
    results
  };
}

function makeAnnualScenario({
  id,
  label,
  income,
  expectations
}) {
  return {
    id,
    label,
    income,
    run() {
      const result = getAnnualResult(income);

      const assertions = [
        ...(typeof expectations.personalAllowance === 'number'
          ? [
              assertClose(
                getPersonalAllowance(result),
                expectations.personalAllowance,
                `${label} — personal allowance`
              )
            ]
          : []),

        ...(typeof expectations.incomeTax === 'number'
          ? [
              assertClose(
                getIncomeTax(result),
                expectations.incomeTax,
                `${label} — income tax`
              )
            ]
          : []),

        ...(typeof expectations.capitalGainsTax === 'number'
          ? [
              assertClose(
                getCapitalGainsTax(result),
                expectations.capitalGainsTax,
                `${label} — capital gains tax`
              )
            ]
          : []),

        ...(typeof expectations.totalTax === 'number'
          ? [
              assertClose(
                getTotalTax(result),
                expectations.totalTax,
                `${label} — total tax`
              )
            ]
          : []),

        ...(typeof expectations.band === 'string'
          ? [
              assertEqual(
                getMarginalBand(result),
                expectations.band,
                `${label} — marginal band`
              )
            ]
          : [])
      ];

      return {
        id,
        label,
        income,
        result,
        assertions: runAssertions(assertions)
      };
    }
  };
}

function buildAnnualScenarios() {
  return [
    makeAnnualScenario({
      id: 'annual_1',
      label: '£0 income → £0 tax',
      income: {},
      expectations: {
        personalAllowance: 12570,
        incomeTax: 0,
        capitalGainsTax: 0,
        totalTax: 0,
        band: 'none'
      }
    }),

    makeAnnualScenario({
      id: 'annual_2',
      label: '£12,570 pension → £0 tax',
      income: { pensionDrawdown: 12570 },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 0,
        totalTax: 0,
        band: 'none'
      }
    }),

    makeAnnualScenario({
      id: 'annual_3',
      label: '£50,270 pension → basic-rate boundary',
      income: { pensionDrawdown: 50270 },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 7540,
        totalTax: 7540,
        band: 'basic'
      }
    }),

    makeAnnualScenario({
      id: 'annual_4',
      label: '£100,000 pension → taper begins but PA still full',
      income: { pensionDrawdown: 100000 },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 27432,
        totalTax: 27432,
        band: 'higher'
      }
    }),

    makeAnnualScenario({
      id: 'annual_5',
      label: '£125,140 pension → PA fully gone',
      income: { pensionDrawdown: 125140 },
      expectations: {
        personalAllowance: 0,
        incomeTax: 42516,
        totalTax: 42516,
        band: 'higher'
      }
    }),

    makeAnnualScenario({
      id: 'annual_6',
      label: '£5,000 interest only → starting rate applies',
      income: { qmmfInterest: 5000 },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 0,
        totalTax: 0,
        band: 'none'
      }
    }),

    makeAnnualScenario({
      id: 'annual_7',
      label: '£12,570 non-savings + £1,000 interest → no starting rate, PSA covers interest',
      income: {
        pensionDrawdown: 12570,
        qmmfInterest: 1000
      },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 0,
        totalTax: 0,
        band: 'none'
      }
    }),

    makeAnnualScenario({
      id: 'annual_8',
      label: 'Higher-rate PSA case',
      income: {
        pensionDrawdown: 50270,
        qmmfInterest: 1500
      },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 7940,
        totalTax: 7940,
        band: 'higher'
      }
    }),

    makeAnnualScenario({
      id: 'annual_9',
      label: 'Additional-rate PSA zero',
      income: {
        pensionDrawdown: 125140,
        qmmfInterest: 1000
      },
      expectations: {
        personalAllowance: 0,
        incomeTax: 42966,
        totalTax: 42966,
        band: 'additional'
      }
    }),

    makeAnnualScenario({
      id: 'annual_10',
      label: '£500 dividends within allowance → £0 dividend tax',
      income: {
        pensionDrawdown: 12570,
        dividends: 500
      },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 0,
        totalTax: 0,
        band: 'none'
      }
    }),

    makeAnnualScenario({
      id: 'annual_11',
      label: '£6,000 dividends above allowance → taxed at basic dividend rate',
      income: {
        pensionDrawdown: 12570,
        dividends: 6000
      },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 591.25,
        totalTax: 591.25,
        band: 'basic'
      }
    }),

    makeAnnualScenario({
      id: 'annual_12',
      label: 'Dividends correctly stack on top of pension',
      income: {
        pensionDrawdown: 50000,
        dividends: 10000
      },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 10814.75,
        totalTax: 10814.75,
        band: 'higher'
      }
    }),

    makeAnnualScenario({
      id: 'annual_13',
      label: 'Mixed income ordering: pension + interest + dividends',
      income: {
        pensionDrawdown: 30000,
        qmmfInterest: 10000,
        dividends: 5000
      },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 5769.75,
        totalTax: 5769.75,
        band: 'basic'
      }
    }),

    makeAnnualScenario({
      id: 'annual_14',
      label: 'CGT below allowance → £0',
      income: {
        taxableGains: 3000
      },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 0,
        capitalGainsTax: 0,
        totalTax: 0,
        band: 'none'
      }
    }),

    makeAnnualScenario({
      id: 'annual_15',
      label: 'CGT above allowance with no income',
      income: {
        taxableGains: 10000
      },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 0,
        capitalGainsTax: 1260,
        totalTax: 1260,
        band: 'none'
      }
    }),

    makeAnnualScenario({
      id: 'annual_16',
      label: 'CGT uses remaining basic-rate band correctly',
      income: {
        pensionDrawdown: 50000,
        taxableGains: 10000
      },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 7486,
        capitalGainsTax: 1663.8,
        totalTax: 9149.8,
        band: 'basic'
      }
    })
  ];
}

function buildHouseholdAssertions() {
  const people = [
    {
      id: 'p1',
      name: 'Person 1',
      income: {
        pensionDrawdown: 35000
      }
    },
    {
      id: 'p2',
      name: 'Person 2',
      income: {
        pensionDrawdown: 12570,
        dividends: 6000
      }
    }
  ];

  const householdResult = getHouseholdResult(people);

  const p1 = getAnnualResult(people[0].income);
  const p2 = getAnnualResult(people[1].income);

  const expectedTotalTax = getTotalTax(p1) + getTotalTax(p2);
  const expectedHigherRatePeople =
    Number(getMarginalBand(p1) === 'higher' || getMarginalBand(p1) === 'additional') +
    Number(getMarginalBand(p2) === 'higher' || getMarginalBand(p2) === 'additional');

  const assertions = [
    assertClose(
      toNumber(householdResult?.household?.taxPaid?.totalTax),
      expectedTotalTax,
      'Household — total tax equals sum of individuals'
    ),
    assertClose(
      toNumber(householdResult?.people?.[0]?.tax?.taxTotals?.totalTax),
      getTotalTax(p1),
      'Household — person 1 tax matches standalone annual tax'
    ),
    assertClose(
      toNumber(householdResult?.people?.[1]?.tax?.taxTotals?.totalTax),
      getTotalTax(p2),
      'Household — person 2 tax matches standalone annual tax'
    ),
    assertEqual(
      toNumber(householdResult?.household?.bandSummary?.peopleWithHigherRateIncome),
      expectedHigherRatePeople,
      'Household — higher-rate people count is correct'
    )
  ];

  return {
    people,
    householdResult,
    assertions: runAssertions(assertions)
  };
}

function buildFullValidationReport() {
  const annualScenarioRuns = buildAnnualScenarios().map((scenario) => scenario.run());
  const householdRun = buildHouseholdAssertions();

  const annualPassed = annualScenarioRuns.reduce(
    (sum, scenario) => sum + scenario.assertions.passed,
    0
  );
  const annualFailed = annualScenarioRuns.reduce(
    (sum, scenario) => sum + scenario.assertions.failed,
    0
  );

  const totalPassed = annualPassed + householdRun.assertions.passed;
  const totalFailed = annualFailed + householdRun.assertions.failed;

  return {
    annualScenarioRuns,
    householdRun,
    summary: {
      totalPassed,
      totalFailed,
      totalAssertions: totalPassed + totalFailed
    }
  };
}

function renderValidationReport() {
  const outputEl = document.getElementById('output');
  if (!outputEl) return;

  const report = buildFullValidationReport();
  const lines = [];

  appendLine(lines, `Tax policy: ${TAX_POLICY_2026_27.taxYear}`);
  appendLine(lines);

  appendLine(lines, '=== TAX ENGINE VALIDATION ===');
  appendLine(lines);
  appendLine(lines, `Assertions passed: ${report.summary.totalPassed}`);
  appendLine(lines, `Assertions failed: ${report.summary.totalFailed}`);
  appendLine(lines, `Assertions total: ${report.summary.totalAssertions}`);
  appendLine(lines);

  appendLine(lines, '=== ANNUAL TAX TESTS ===');
  appendLine(lines);

  report.annualScenarioRuns.forEach((scenario, index) => {
    appendLine(lines, `${index + 1}. ${scenario.label}`);
    appendLine(lines, `Input: ${JSON.stringify(scenario.income)}`, 3);

    scenario.assertions.results.forEach((assertion) => {
      appendLine(lines, assertion.message, 3);
    });

    appendLine(
      lines,
      `Resulting Personal Allowance: ${formatCurrency(getPersonalAllowance(scenario.result))}`,
      3
    );
    appendLine(
      lines,
      `Resulting Income Tax: ${formatCurrency(getIncomeTax(scenario.result))}`,
      3
    );
    appendLine(
      lines,
      `Resulting CGT: ${formatCurrency(getCapitalGainsTax(scenario.result))}`,
      3
    );
    appendLine(
      lines,
      `Resulting Total Tax: ${formatCurrency(getTotalTax(scenario.result))}`,
      3
    );
    appendLine(
      lines,
      `Marginal Band: ${getMarginalBand(scenario.result)}`,
      3
    );
    appendLine(lines);
  });

  appendLine(lines, '=== HOUSEHOLD TAX TESTS ===');
  appendLine(lines);

  report.householdRun.assertions.results.forEach((assertion) => {
    appendLine(lines, assertion.message);
  });

  appendLine(
    lines,
    `Household Total Tax: ${formatCurrency(
      report.householdRun.householdResult?.household?.taxPaid?.totalTax
    )}`
  );
  appendLine(
    lines,
    `Household Net After Tax: ${formatCurrency(
      report.householdRun.householdResult?.household?.netAfterAllTax
    )}`
  );
  appendLine(
    lines,
    `Higher Rate People: ${toNumber(
      report.householdRun.householdResult?.household?.bandSummary?.peopleWithHigherRateIncome
    )}`
  );
  appendLine(lines);

  outputEl.textContent = lines.join('\n');

  console.group('UK Tax Engine Validation');
  console.log(report);
  console.groupEnd();
}

const btn = document.getElementById('runTestsBtn');

if (btn) {
  btn.addEventListener('click', renderValidationReport);
}

renderValidationReport();