// tax/policy.js

/**
 * 2026-27 UK tax policy assumptions for this planner.
 *
 * Scope for Step 1:
 * - England / Wales / Northern Ireland income tax bands
 * - Savings ordering after non-savings income
 * - Dividend ordering after savings income
 * - CGT is passive/manual only, not optimised
 *
 * Important:
 * - This module is intentionally data-only.
 * - No functions here beyond simple exports.
 */

export const TAX_POLICY_2026_27 = Object.freeze({
  taxYear: '2026-27',
  region: 'rUK',

  incomeTax: Object.freeze({
    personalAllowance: 12_570,
    personalAllowanceTaperThreshold: 100_000,
    personalAllowanceTaperLimit: 125_140,
    personalAllowanceTaperRate: 0.5, // £1 allowance lost per £2 ANI above threshold

    basicRateLimit: 37_700, // taxable income after PA
    higherRateLimit: 125_140, // total taxable income threshold
    additionalRateThreshold: 125_140,

    rates: Object.freeze({
      basic: 0.20,
      higher: 0.40,
      additional: 0.45
    })
  }),

  savings: Object.freeze({
    startingRateLimit: 5_000,

    personalSavingsAllowance: Object.freeze({
      basic: 1_000,
      higher: 500,
      additional: 0
    }),

    rates: Object.freeze({
      basic: 0.20,
      higher: 0.40,
      additional: 0.45
    })
  }),

  dividends: Object.freeze({
    allowance: 500,
    rates: Object.freeze({
      basic: 0.1075,
      higher: 0.3575,
      additional: 0.3935
    })
  }),

  capitalGains: Object.freeze({
    annualExemptAmount: 3_000,

    // Phase 1 scope:
    // use standard rates only, not residential property or carried interest
    rates: Object.freeze({
      basic: 0.18,
      higher: 0.24
    })
  }),

  ordering: Object.freeze([
    'nonSavings',
    'savings',
    'dividends'
  ]),

  metadata: Object.freeze({
    notes: Object.freeze([
      'Personal Allowance taper based on adjusted net income.',
      'Income ordering is non-savings, then savings, then dividends.',
      'Starting Rate for Savings is reduced £1-for-£1 by taxable non-savings income above the Personal Allowance.',
      'PSA depends on the taxpayer marginal band after taxable non-savings + savings income is considered.',
      'CGT is passive/manual only in Phase 1.'
    ])
  })
});

export default TAX_POLICY_2026_27;