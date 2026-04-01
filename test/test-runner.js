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

function clampToZero(value) {
  return Math.max(0, toNumber(value));
}

function hasNaNDeep(value) {
  if (typeof value === 'number') return Number.isNaN(value);
  if (Array.isArray(value)) return value.some(hasNaNDeep);
  if (value && typeof value === 'object') {
    return Object.values(value).some(hasNaNDeep);
  }
  return false;
}

function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return `[unserialisable: ${error?.message || 'unknown error'}]`;
  }
}

function makeAssertion(pass, label, actual, expected, message, meta = {}) {
  return {
    pass: Boolean(pass),
    label,
    actual,
    expected,
    message,
    ...meta
  };
}

function assertEqual(actual, expected, label) {
  const pass = actual === expected;
  return makeAssertion(
    pass,
    label,
    actual,
    expected,
    `${pass ? 'PASS' : 'FAIL'}: ${label} (actual: ${actual}, expected: ${expected})`
  );
}

function assertClose(actual, expected, label, epsilon = 0.01) {
  const a = toNumber(actual);
  const e = toNumber(expected);
  const pass = Math.abs(a - e) <= epsilon;

  return makeAssertion(
    pass,
    label,
    actual,
    expected,
    `${pass ? 'PASS' : 'FAIL'}: ${label} (actual: ${actual}, expected: ${expected})`
  );
}

function assertTrue(condition, label, actual, expected = true) {
  const pass = Boolean(condition);
  return makeAssertion(
    pass,
    label,
    actual,
    expected,
    `${pass ? 'PASS' : 'FAIL'}: ${label} (actual: ${actual}, expected: ${expected})`
  );
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

function getNetAfterAllTax(result) {
  return toNumber(
    result?.totals?.netAfterAllTax ??
      result?.taxTotals?.netAfterAllTax ??
      result?.netAfterAllTax
  );
}

function getTaxableIncome(result) {
  return toNumber(
    result?.totals?.taxableIncome ??
      result?.incomeTotals?.taxableIncome ??
      result?.taxableIncome
  );
}

function getStartingRateSavingsBandUsed(result) {
  return toNumber(
    result?.allowances?.startingRateForSavingsUsed ??
      result?.allowances?.startingRateSavingsUsed ??
      result?.allowances?.startingRateUsed
  );
}

function getPersonalSavingsAllowanceUsed(result) {
  return toNumber(
    result?.allowances?.personalSavingsAllowanceUsed ??
      result?.allowances?.psaUsed
  );
}

function getDividendAllowanceUsed(result) {
  return toNumber(
    result?.allowances?.dividendAllowanceUsed
  );
}

function getTaxableGains(result) {
  return toNumber(
    result?.capitalGains?.taxableGains ??
      result?.taxTotals?.taxableGains ??
      result?.totals?.taxableGains
  );
}

function logAssertion(assertion) {
  if (!assertion.pass) {
    console.error(assertion.message, {
      actual: assertion.actual,
      expected: assertion.expected,
      label: assertion.label,
      scenarioId: assertion.scenarioId,
      scenarioLabel: assertion.scenarioLabel,
      input: assertion.input,
      result: assertion.result
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

function withScenarioMeta(assertion, scenario, result) {
  return {
    ...assertion,
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    input: scenario.income || scenario.people || null,
    result
  };
}

function addDefensiveAssertions(assertions, scenario, result) {
  const marginalBand = getMarginalBand(result);
  const totalTax = getTotalTax(result);
  const incomeTax = getIncomeTax(result);
  const capitalGainsTax = getCapitalGainsTax(result);
  const personalAllowance = getPersonalAllowance(result);
  const netAfterAllTax = getNetAfterAllTax(result);

  assertions.push(
    withScenarioMeta(
      assertTrue(totalTax >= 0, `${scenario.label} — total tax never negative`, totalTax, '>= 0'),
      scenario,
      result
    )
  );

  assertions.push(
    withScenarioMeta(
      assertTrue(incomeTax >= 0, `${scenario.label} — income tax never negative`, incomeTax, '>= 0'),
      scenario,
      result
    )
  );

  assertions.push(
    withScenarioMeta(
      assertTrue(
        capitalGainsTax >= 0,
        `${scenario.label} — capital gains tax never negative`,
        capitalGainsTax,
        '>= 0'
      ),
      scenario,
      result
    )
  );

  assertions.push(
    withScenarioMeta(
      assertTrue(
        personalAllowance >= 0,
        `${scenario.label} — personal allowance never negative`,
        personalAllowance,
        '>= 0'
      ),
      scenario,
      result
    )
  );

  assertions.push(
    withScenarioMeta(
      assertTrue(
        ['none', 'basic', 'higher', 'additional'].includes(marginalBand),
        `${scenario.label} — marginal band valid`,
        marginalBand,
        'none | basic | higher | additional'
      ),
      scenario,
      result
    )
  );

  assertions.push(
    withScenarioMeta(
      assertClose(
        totalTax,
        incomeTax + capitalGainsTax,
        `${scenario.label} — total tax equals income tax plus CGT`
      ),
      scenario,
      result
    )
  );

  assertions.push(
    withScenarioMeta(
      assertTrue(
        !hasNaNDeep(result),
        `${scenario.label} — result contains no NaN`,
        hasNaNDeep(result),
        false
      ),
      scenario,
      result
    )
  );

  if (Number.isFinite(netAfterAllTax)) {
    assertions.push(
      withScenarioMeta(
        assertTrue(
          netAfterAllTax >= 0,
          `${scenario.label} — net after all tax not negative`,
          netAfterAllTax,
          '>= 0'
        ),
        scenario,
        result
      )
    );
  }
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
              withScenarioMeta(
                assertClose(
                  getPersonalAllowance(result),
                  expectations.personalAllowance,
                  `${label} — personal allowance`
                ),
                { id, label, income },
                result
              )
            ]
          : []),

        ...(typeof expectations.incomeTax === 'number'
          ? [
              withScenarioMeta(
                assertClose(
                  getIncomeTax(result),
                  expectations.incomeTax,
                  `${label} — income tax`
                ),
                { id, label, income },
                result
              )
            ]
          : []),

        ...(typeof expectations.capitalGainsTax === 'number'
          ? [
              withScenarioMeta(
                assertClose(
                  getCapitalGainsTax(result),
                  expectations.capitalGainsTax,
                  `${label} — capital gains tax`
                ),
                { id, label, income },
                result
              )
            ]
          : []),

        ...(typeof expectations.totalTax === 'number'
          ? [
              withScenarioMeta(
                assertClose(
                  getTotalTax(result),
                  expectations.totalTax,
                  `${label} — total tax`
                ),
                { id, label, income },
                result
              )
            ]
          : []),

        ...(typeof expectations.band === 'string'
          ? [
              withScenarioMeta(
                assertEqual(
                  getMarginalBand(result),
                  expectations.band,
                  `${label} — marginal band`
                ),
                { id, label, income },
                result
              )
            ]
          : []),

        ...(typeof expectations.startingRateUsed === 'number'
          ? [
              withScenarioMeta(
                assertClose(
                  getStartingRateSavingsBandUsed(result),
                  expectations.startingRateUsed,
                  `${label} — starting rate savings used`
                ),
                { id, label, income },
                result
              )
            ]
          : []),

        ...(typeof expectations.personalSavingsAllowanceUsed === 'number'
          ? [
              withScenarioMeta(
                assertClose(
                  getPersonalSavingsAllowanceUsed(result),
                  expectations.personalSavingsAllowanceUsed,
                  `${label} — PSA used`
                ),
                { id, label, income },
                result
              )
            ]
          : []),

        ...(typeof expectations.dividendAllowanceUsed === 'number'
          ? [
              withScenarioMeta(
                assertClose(
                  getDividendAllowanceUsed(result),
                  expectations.dividendAllowanceUsed,
                  `${label} — dividend allowance used`
                ),
                { id, label, income },
                result
              )
            ]
          : [])
      ];

      addDefensiveAssertions(assertions, { id, label, income }, result);

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
      label: '£100,000 pension → taper starts but PA still full',
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
      label: '£100,001 pension → PA reduced by £0.50',
      income: { pensionDrawdown: 100001 },
      expectations: {
        personalAllowance: 12569.5,
        incomeTax: 27432.2,
        totalTax: 27432.2,
        band: 'higher'
      }
    }),

    makeAnnualScenario({
      id: 'annual_6',
      label: '£110,000 pension → PA tapered correctly',
      income: { pensionDrawdown: 110000 },
      expectations: {
        personalAllowance: 7570,
        incomeTax: 31432,
        totalTax: 31432,
        band: 'higher'
      }
    }),

    makeAnnualScenario({
      id: 'annual_7',
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
      id: 'annual_8',
      label: '£125,141 pension → above PA exhaustion boundary',
      income: { pensionDrawdown: 125141 },
      expectations: {
        personalAllowance: 0,
        incomeTax: 42516.45,
        totalTax: 42516.45,
        band: 'additional'
      }
    }),

    makeAnnualScenario({
      id: 'annual_9',
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
      id: 'annual_10',
      label: 'Starting rate partially reduced',
      income: {
        pensionDrawdown: 14570,
        qmmfInterest: 4000
      },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 0,
        totalTax: 0,
        band: 'basic'
      }
    }),

    makeAnnualScenario({
      id: 'annual_11',
      label: 'Starting rate fully eliminated',
      income: {
        pensionDrawdown: 17570,
        qmmfInterest: 4000
      },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 600,
        totalTax: 600,
        band: 'basic'
      }
    }),

    makeAnnualScenario({
      id: 'annual_12',
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
      id: 'annual_13',
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
      id: 'annual_14',
      label: 'PSA interaction crossing into higher rate mid-stack',
      income: {
        pensionDrawdown: 50000,
        qmmfInterest: 2000
      },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 7848,
        totalTax: 7848,
        band: 'higher'
      }
    }),

    makeAnnualScenario({
      id: 'annual_15',
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
      id: 'annual_16',
      label: '£500 dividends within allowance → £0 dividend tax',
      income: {
        pensionDrawdown: 12570,
        dividends: 500
      },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 0,
        totalTax: 0,
        band: 'none',
        dividendAllowanceUsed: 500
      }
    }),

    makeAnnualScenario({
      id: 'annual_17',
      label: '£501 dividends → just above dividend allowance',
      income: {
        pensionDrawdown: 12570,
        dividends: 501
      },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 0.09,
        totalTax: 0.09,
        band: 'basic'
      }
    }),

    makeAnnualScenario({
      id: 'annual_18',
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
      id: 'annual_19',
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
      id: 'annual_20',
      label: 'Dividends in additional-rate zone',
      income: {
        pensionDrawdown: 130000,
        dividends: 10000
      },
      expectations: {
        personalAllowance: 0,
        incomeTax: 48365,
        totalTax: 48365,
        band: 'additional'
      }
    }),

    makeAnnualScenario({
      id: 'annual_21',
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
      id: 'annual_22',
      label: 'Mixed income stress across bands',
      income: {
        pensionDrawdown: 60000,
        qmmfInterest: 8000,
        dividends: 12000
      },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 18030.25,
        totalTax: 18030.25,
        band: 'higher'
      }
    }),

    makeAnnualScenario({
      id: 'annual_23',
      label: 'CGT exactly at allowance → £0',
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
      id: 'annual_24',
      label: 'CGT just above allowance',
      income: {
        taxableGains: 3001
      },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 0,
        capitalGainsTax: 0.18,
        totalTax: 0.18,
        band: 'none'
      }
    }),

    makeAnnualScenario({
      id: 'annual_25',
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
      id: 'annual_26',
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
    }),

    makeAnnualScenario({
      id: 'annual_27',
      label: 'CGT when income fully consumes basic band',
      income: {
        pensionDrawdown: 80000,
        taxableGains: 10000
      },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 19432,
        capitalGainsTax: 1680,
        totalTax: 21112,
        band: 'higher'
      }
    }),

    makeAnnualScenario({
      id: 'annual_28',
      label: 'Empty object input',
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
      id: 'annual_29',
      label: 'Missing fields input',
      income: {
        pensionDrawdown: 12000,
        qmmfInterest: undefined,
        dividends: undefined,
        taxableGains: undefined
      },
      expectations: {
        personalAllowance: 12570,
        incomeTax: 0,
        totalTax: 0,
        band: 'none'
      }
    }),

    makeAnnualScenario({
      id: 'annual_30',
      label: 'Null-heavy input',
      income: {
        pensionDrawdown: null,
        qmmfInterest: null,
        dividends: null,
        taxableGains: null
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
      id: 'annual_31',
      label: 'Negative values clamp or fail cleanly',
      income: {
        pensionDrawdown: -1000,
        qmmfInterest: -250,
        dividends: -100,
        taxableGains: -10
      },
      expectations: {
        incomeTax: 0,
        capitalGainsTax: 0,
        totalTax: 0
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
    ),
    assertTrue(
      toNumber(householdResult?.household?.taxPaid?.totalTax) >= 0,
      'Household — total tax never negative',
      householdResult?.household?.taxPaid?.totalTax,
      '>= 0'
    ),
    assertTrue(
      !hasNaNDeep(householdResult),
      'Household — result contains no NaN',
      hasNaNDeep(householdResult),
      false
    )
  ];

  const scenario = {
    id: 'household_1',
    label: 'Household validation',
    people
  };

  const decoratedAssertions = assertions.map((assertion) =>
    withScenarioMeta(assertion, scenario, householdResult)
  );

  return {
    people,
    householdResult,
    assertions: runAssertions(decoratedAssertions)
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

  const failedScenarios = [
    ...annualScenarioRuns
      .filter((scenario) => scenario.assertions.failed > 0)
      .map((scenario) => ({
        type: 'annual',
        id: scenario.id,
        label: scenario.label,
        input: scenario.income,
        result: scenario.result,
        failures: scenario.assertions.results.filter((r) => !r.pass)
      })),
    ...(householdRun.assertions.failed > 0
      ? [
          {
            type: 'household',
            id: 'household_1',
            label: 'Household validation',
            input: householdRun.people,
            result: householdRun.householdResult,
            failures: householdRun.assertions.results.filter((r) => !r.pass)
          }
        ]
      : [])
  ];

  return {
    annualScenarioRuns,
    householdRun,
    failedScenarios,
    summary: {
      totalPassed,
      totalFailed,
      totalAssertions: totalPassed + totalFailed,
      scenariosRun: annualScenarioRuns.length + 1,
      scenariosFailed: failedScenarios.length
    }
  };
}

function renderFailureBlock(lines, failedScenario) {
  appendLine(lines, '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  appendLine(lines, `FAILURE: ${failedScenario.label}`);
  appendLine(lines, `Scenario ID: ${failedScenario.id}`);
  appendLine(lines, `Input: ${safeStringify(failedScenario.input)}`);

  failedScenario.failures.forEach((failure, index) => {
    appendLine(lines, `Failure ${index + 1}: ${failure.label}`, 2);
    appendLine(lines, `Expected: ${failure.expected}`, 4);
    appendLine(lines, `Actual: ${failure.actual}`, 4);
  });

  appendLine(lines, 'Result snapshot:', 2);
  appendLine(lines, safeStringify(failedScenario.result), 4);
  appendLine(lines, '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  appendLine(lines);
}

function renderValidationReport() {
  const outputEl = document.getElementById('output');
  if (!outputEl) return;

  const report = buildFullValidationReport();
  const lines = [];

  appendLine(lines, `Tax policy: ${TAX_POLICY_2026_27.taxYear}`);
  appendLine(lines);

  appendLine(lines, '=== UK TAX ENGINE ROBUSTNESS VALIDATION ===');
  appendLine(lines);
  appendLine(lines, `Scenarios run: ${report.summary.scenariosRun}`);
  appendLine(lines, `Scenarios failed: ${report.summary.scenariosFailed}`);
  appendLine(lines, `Assertions passed: ${report.summary.totalPassed}`);
  appendLine(lines, `Assertions failed: ${report.summary.totalFailed}`);
  appendLine(lines, `Assertions total: ${report.summary.totalAssertions}`);
  appendLine(lines);

  if (report.failedScenarios.length > 0) {
    appendLine(lines, '=== FAILURES BY SCENARIO ===');
    appendLine(lines);

    report.failedScenarios.forEach((failedScenario) => {
      renderFailureBlock(lines, failedScenario);
    });
  } else {
    appendLine(lines, '=== FAILURES BY SCENARIO ===');
    appendLine(lines, 'None');
    appendLine(lines);
  }

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

  console.group('UK Tax Engine Robustness Validation');
  console.log(report);

  if (report.failedScenarios.length > 0) {
    console.group('Failures by scenario');
    report.failedScenarios.forEach((failedScenario) => {
      console.error(failedScenario.label, {
        id: failedScenario.id,
        input: failedScenario.input,
        failures: failedScenario.failures,
        result: failedScenario.result
      });
    });
    console.groupEnd();
  }

  console.groupEnd();
}

const btn = document.getElementById('runTestsBtn');

if (btn) {
  btn.addEventListener('click', renderValidationReport);
}

renderValidationReport();