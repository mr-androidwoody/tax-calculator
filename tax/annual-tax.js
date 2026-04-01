// tax/annual-tax.js

import TAX_POLICY_2026_27 from './policy.js';
import {
  normaliseIncome,
  summariseIncomeByType
} from './classify-income.js';
import {
  resolveIncomeAllowances
} from './allowances.js';
import {
  taxUsingBands,
  taxSavingsIncome,
  taxDividendIncome,
  taxCapitalGains,
  determineMarginalIncomeBand
} from './bands.js';

/**
 * Calculate full annual tax for one person.
 *
 * Input shape:
 * {
 *   statePension?: number,
 *   dbPension?: number,
 *   pensionDrawdown?: number,
 *   employment?: number,
 *   selfEmployment?: number,
 *   otherTaxable?: number,
 *   qmmfInterest?: number,
 *   cashInterest?: number,
 *   otherSavings?: number,
 *   dividends?: number,
 *   taxableGains?: number
 * }
 *
 * Output is intentionally verbose for downstream planner/debugging use.
 *
 * @param {object} rawIncome
 * @param {object} [policy=TAX_POLICY_2026_27]
 * @returns {object}
 */
export function calculateAnnualTax(rawIncome = {}, policy = TAX_POLICY_2026_27) {
  const income = normaliseIncome(rawIncome);
  const totals = summariseIncomeByType(rawIncome);

  // DEBUG
  console.log('ANNUAL TAX DEBUG', {
    rawIncome,
    income,
    totals
  });

  const allowances = resolveIncomeAllowances(totals, policy);

  const taxableNonSavingsAfterPA =
    allowances.personalAllowanceAllocation.taxableAfterPA.nonSavings;

  const taxableSavingsAfterPA =
    allowances.personalAllowanceAllocation.taxableAfterPA.savings;

  const taxableDividendsAfterPA =
    allowances.personalAllowanceAllocation.taxableAfterPA.dividends;

  const taxableSavingsAfterAllowances =
    allowances.savingsAllowances.taxableSavingsAfterAllowances;

  const taxableDividendsAfterAllowance =
    allowances.dividendAllowance.taxableDividendsAfterAllowance;

  const nonSavingsTax = taxUsingBands(
    {
      amount: taxableNonSavingsAfterPA,
      usedBasicBand: 0,
      usedHigherBand: 0,
      rates: policy.incomeTax.rates
    },
    policy
  );

  const savingsTax = taxSavingsIncome(
    {
      amount: taxableSavingsAfterAllowances,
      usedBasicBand: nonSavingsTax.endingBandUsage.basic,
      usedHigherBand: nonSavingsTax.endingBandUsage.higher
    },
    policy
  );

  const dividendsTax = taxDividendIncome(
    {
      amount: taxableDividendsAfterAllowance,
      usedBasicBand:
        savingsTax.endingBandUsage.basic,
      usedHigherBand:
        savingsTax.endingBandUsage.higher
    },
    policy
  );

  const taxableIncomeBeforeGains =
    taxableNonSavingsAfterPA +
    taxableSavingsAfterAllowances +
    taxableDividendsAfterAllowance;

  const cgt = taxCapitalGains(
    {
      taxableGains: totals.capitalGains,
      taxableIncomeBeforeGains
    },
    policy
  );

  const incomeTaxTotal =
    nonSavingsTax.tax +
    savingsTax.tax +
    dividendsTax.tax;

  const totalTax = incomeTaxTotal + cgt.tax;

  const finalTaxableIncome =
    taxableIncomeBeforeGains;

  const marginalBand = determineMarginalIncomeBand(
    finalTaxableIncome,
    policy
  );

  return {
    policy: {
      taxYear: policy.taxYear,
      region: policy.region
    },

    inputs: {
      income
    },

    totals: {
      grossIncome: {
        nonSavings: totals.nonSavings,
        savings: totals.savings,
        dividends: totals.dividends,
        capitalGains: totals.capitalGains,
        totalTaxableIncome:
          totals.nonSavings + totals.savings + totals.dividends
      },

      taxableIncome: {
        nonSavings: taxableNonSavingsAfterPA,
        savings: taxableSavingsAfterAllowances,
        dividends: taxableDividendsAfterAllowance,
        totalIncomeTaxBase: finalTaxableIncome
      }
    },

    allowances: {
      adjustedNetIncome: allowances.adjustedNetIncome,
      personalAllowance: allowances.personalAllowance,
      personalAllowanceUsed:
        allowances.personalAllowanceAllocation.used,
      personalAllowanceByType:
        allowances.personalAllowanceAllocation.byType,

      startingRateForSavings: {
        bandAvailable:
          allowances.savingsAllowances.startingRateBandAvailable,
        used:
          allowances.savingsAllowances.startingRateUsed
      },

      personalSavingsAllowance: {
        band:
          allowances.savingsAllowances.psaBand,
        available:
          allowances.savingsAllowances.psaAvailable,
        used:
          allowances.savingsAllowances.psaUsed
      },

      dividendAllowance: {
        available:
          allowances.dividendAllowance.dividendAllowanceAvailable,
        used:
          allowances.dividendAllowance.dividendAllowanceUsed
      },

      capitalGainsAnnualExemptAmount: {
        available: policy.capitalGains.annualExemptAmount,
        used: cgt.exemptUsed
      }
    },

    breakdown: {
      nonSavings: {
        gross: totals.nonSavings,
        taxableAfterPA: taxableNonSavingsAfterPA,
        tax: nonSavingsTax.tax,
        basicPortion: nonSavingsTax.basicPortion,
        higherPortion: nonSavingsTax.higherPortion,
        additionalPortion: nonSavingsTax.additionalPortion
      },

      savings: {
        gross: totals.savings,
        taxableAfterPA: taxableSavingsAfterPA,
        startingRateUsed: allowances.savingsAllowances.startingRateUsed,
        psaUsed: allowances.savingsAllowances.psaUsed,
        taxableAfterAllowances: taxableSavingsAfterAllowances,
        tax: savingsTax.tax,
        basicPortion: savingsTax.basicPortion,
        higherPortion: savingsTax.higherPortion,
        additionalPortion: savingsTax.additionalPortion
      },

      dividends: {
        gross: totals.dividends,
        taxableAfterPA: taxableDividendsAfterPA,
        dividendAllowanceUsed:
          allowances.dividendAllowance.dividendAllowanceUsed,
        taxableAfterAllowance: taxableDividendsAfterAllowance,
        tax: dividendsTax.tax,
        basicPortion: dividendsTax.basicPortion,
        higherPortion: dividendsTax.higherPortion,
        additionalPortion: dividendsTax.additionalPortion
      },

      capitalGains: {
        gross: totals.capitalGains,
        annualExemptAmountUsed: cgt.exemptUsed,
        taxableAfterExemption: cgt.gainsAfterExemption,
        basicRatePortion: cgt.basicRatePortion,
        higherRatePortion: cgt.higherRatePortion,
        tax: cgt.tax
      }
    },

    bandSummary: {
      marginalIncomeBand: marginalBand,
      hasHigherRateIncome:
        nonSavingsTax.higherPortion +
          savingsTax.higherPortion +
          dividendsTax.higherPortion >
        0,
      hasAdditionalRateIncome:
        nonSavingsTax.additionalPortion +
          savingsTax.additionalPortion +
          dividendsTax.additionalPortion >
        0
    },

    taxTotals: {
      incomeTax: incomeTaxTotal,
      capitalGainsTax: cgt.tax,
      totalTax
    },

    netIncomeAfterTax: {
      grossCashIncome:
        totals.nonSavings + totals.savings + totals.dividends,
      afterIncomeTax:
        (totals.nonSavings + totals.savings + totals.dividends) - incomeTaxTotal,
      afterAllTax:
        (totals.nonSavings + totals.savings + totals.dividends) - totalTax
    }
  };
}

/**
 * Minimal compact view for planner usage where full detail is not needed.
 *
 * @param {object} rawIncome
 * @param {object} [policy=TAX_POLICY_2026_27]
 * @returns {object}
 */
export function calculateAnnualTaxCompact(rawIncome = {}, policy = TAX_POLICY_2026_27) {
  const result = calculateAnnualTax(rawIncome, policy);

  return {
    totalTax: result.taxTotals.totalTax,
    incomeTax: result.taxTotals.incomeTax,
    capitalGainsTax: result.taxTotals.capitalGainsTax,
    personalAllowance: result.allowances.personalAllowance,
    marginalIncomeBand: result.bandSummary.marginalIncomeBand,
    hasHigherRateIncome: result.bandSummary.hasHigherRateIncome,
    hasAdditionalRateIncome: result.bandSummary.hasAdditionalRateIncome,
    grossCashIncome: result.netIncomeAfterTax.grossCashIncome,
    netAfterAllTax: result.netIncomeAfterTax.afterAllTax
  };
}

export default {
  calculateAnnualTax,
  calculateAnnualTaxCompact
};