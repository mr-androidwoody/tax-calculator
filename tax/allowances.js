import { getAdjustedNetIncome } from './classify-income.js';

/**
 * Personal Allowance after ANI taper.
 *
 * @param {number} adjustedNetIncome
 * @param {object} policy
 * @returns {number}
 */
export function calculatePersonalAllowance(adjustedNetIncome, policy) {
  const {
    personalAllowance,
    personalAllowanceTaperThreshold
  } = policy.incomeTax;

  const ani = Math.max(0, Number(adjustedNetIncome) || 0);

  if (ani <= personalAllowanceTaperThreshold) {
    return personalAllowance;
  }

  const reduction = (ani - personalAllowanceTaperThreshold) / 2;
  return Math.max(0, personalAllowance - reduction);
}

/**
 * Allocate Personal Allowance in statutory order:
 * non-savings -> savings -> dividends
 *
 * @param {{nonSavings:number, savings:number, dividends:number}} totals
 * @param {number} personalAllowance
 * @returns {{
 *   used: number,
 *   remaining: number,
 *   byType: { nonSavings:number, savings:number, dividends:number },
 *   taxableAfterPA: { nonSavings:number, savings:number, dividends:number }
 * }}
 */
export function allocatePersonalAllowance(totals, personalAllowance) {
  let remaining = Math.max(0, Number(personalAllowance) || 0);

  const nsIncome = Math.max(0, Number(totals?.nonSavings) || 0);
  const sIncome = Math.max(0, Number(totals?.savings) || 0);
  const dIncome = Math.max(0, Number(totals?.dividends) || 0);

  const nsUsed = Math.min(nsIncome, remaining);
  remaining -= nsUsed;

  const sUsed = Math.min(sIncome, remaining);
  remaining -= sUsed;

  const dUsed = Math.min(dIncome, remaining);
  remaining -= dUsed;

  return {
    used: nsUsed + sUsed + dUsed,
    remaining,
    byType: {
      nonSavings: nsUsed,
      savings: sUsed,
      dividends: dUsed
    },
    taxableAfterPA: {
      nonSavings: nsIncome - nsUsed,
      savings: sIncome - sUsed,
      dividends: dIncome - dUsed
    }
  };
}

/**
 * Starting Rate for Savings band available after taxable non-savings income.
 *
 * Rule:
 * - maximum starting-rate band is £5,000
 * - reduced £1-for-£1 by taxable non-savings income above the Personal Allowance
 * - after PA has been allocated, that is equivalent to:
 *   available band = max(0, 5000 - taxableNonSavingsAfterPA)
 *
 * @param {number} taxableNonSavingsAfterPA
 * @param {object} policy
 * @returns {number}
 */
export function calculateStartingRateForSavingsBand(
  taxableNonSavingsAfterPA,
  policy
) {
  const band = policy.savings.startingRateLimit;
  const nsTaxable = Math.max(0, Number(taxableNonSavingsAfterPA) || 0);

  return Math.max(0, band - nsTaxable);
}

/**
 * Marginal band for PSA purposes.
 *
 * For PSA, HMRC treatment depends on whether the taxpayer is a:
 * - basic-rate taxpayer
 * - higher-rate taxpayer
 * - additional-rate taxpayer
 *
 * We determine this by taxable non-savings + savings income
 * after PA, but before dividends.
 *
 * @param {number} taxableNonSavingsAfterPA
 * @param {number} taxableSavingsAfterStartingRate
 * @param {object} policy
 * @returns {'basic'|'higher'|'additional'}
 */
export function determineSavingsPSABand(
  taxableNonSavingsAfterPA,
  taxableSavingsAfterStartingRate,
  policy
) {
  const total = (
    Math.max(0, Number(taxableNonSavingsAfterPA) || 0) +
    Math.max(0, Number(taxableSavingsAfterStartingRate) || 0)
  );

  const basicRateCeiling = policy.incomeTax.basicRateLimit;
  const higherRateCeiling = policy.incomeTax.higherRateLimit;

  if (total <= basicRateCeiling) {
    return 'basic';
  }

  if (total <= higherRateCeiling) {
    return 'higher';
  }

  return 'additional';
}

/**
 * Personal Savings Allowance available for the year.
 *
 * @param {'basic'|'higher'|'additional'} psaBand
 * @param {object} policy
 * @returns {number}
 */
export function calculatePersonalSavingsAllowance(psaBand, policy) {
  const allowances = policy.savings.personalSavingsAllowance;
  return allowances[psaBand] ?? 0;
}

/**
 * Allocate starting-rate band and PSA against savings income.
 *
 * @param {number} taxableSavingsAfterPA
 * @param {number} taxableNonSavingsAfterPA
 * @param {object} policy
 * @returns {{
 *   startingRateBandAvailable:number,
 *   startingRateUsed:number,
 *   psaBand:'basic'|'higher'|'additional',
 *   psaAvailable:number,
 *   psaUsed:number,
 *   taxableSavingsAfterAllowances:number
 * }}
 */
export function applySavingsAllowances(
  taxableSavingsAfterPA,
  taxableNonSavingsAfterPA,
  policy
) {
  const savingsAfterPA = Math.max(0, Number(taxableSavingsAfterPA) || 0);

  const startingRateBandAvailable = calculateStartingRateForSavingsBand(
    taxableNonSavingsAfterPA,
    policy
  );

  const startingRateUsed = Math.min(savingsAfterPA, startingRateBandAvailable);
  const remainingAfterStartingRate = savingsAfterPA - startingRateUsed;

  const psaBand = determineSavingsPSABand(
    taxableNonSavingsAfterPA,
    remainingAfterStartingRate,
    policy
  );

  const psaAvailable = calculatePersonalSavingsAllowance(psaBand, policy);
  const psaUsed = Math.min(remainingAfterStartingRate, psaAvailable);

  return {
    startingRateBandAvailable,
    startingRateUsed,
    psaBand,
    psaAvailable,
    psaUsed,
    taxableSavingsAfterAllowances:
      remainingAfterStartingRate - psaUsed
  };
}

/**
 * Apply dividend allowance.
 *
 * @param {number} taxableDividendsAfterPA
 * @param {object} policy
 * @returns {{
 *   dividendAllowanceAvailable:number,
 *   dividendAllowanceUsed:number,
 *   taxableDividendsAfterAllowance:number
 * }}
 */
export function applyDividendAllowance(
  taxableDividendsAfterPA,
  policy
) {
  const dividendsAfterPA = Math.max(0, Number(taxableDividendsAfterPA) || 0);
  const allowance = policy.dividends.allowance;

  const used = Math.min(dividendsAfterPA, allowance);

  return {
    dividendAllowanceAvailable: allowance,
    dividendAllowanceUsed: used,
    taxableDividendsAfterAllowance: dividendsAfterPA - used
  };
}

/**
 * Full allowance resolution helper from raw income totals.
 *
 * @param {{nonSavings:number,savings:number,dividends:number}} totals
 * @param {object} policy
 * @returns {object}
 */
export function resolveIncomeAllowances(totals, policy) {
  const adjustedNetIncome = (
    Math.max(0, Number(totals?.nonSavings) || 0) +
    Math.max(0, Number(totals?.savings) || 0) +
    Math.max(0, Number(totals?.dividends) || 0)
  );

  const personalAllowance = calculatePersonalAllowance(adjustedNetIncome, policy);
  const paAllocation = allocatePersonalAllowance(totals, personalAllowance);

  const savingsAllowances = applySavingsAllowances(
    paAllocation.taxableAfterPA.savings,
    paAllocation.taxableAfterPA.nonSavings,
    policy
  );

  const dividendAllowance = applyDividendAllowance(
    paAllocation.taxableAfterPA.dividends,
    policy
  );

  return {
    adjustedNetIncome,
    personalAllowance,
    personalAllowanceAllocation: paAllocation,
    savingsAllowances,
    dividendAllowance
  };
}

/**
 * Convenience helper from raw income object.
 *
 * @param {object} income
 * @param {object} policy
 * @returns {object}
 */
export function resolveAllowancesFromIncome(income, policy) {
  const adjustedNetIncome = getAdjustedNetIncome(income);
  const personalAllowance = calculatePersonalAllowance(adjustedNetIncome, policy);

  return {
    adjustedNetIncome,
    personalAllowance
  };
}

export default {
  calculatePersonalAllowance,
  allocatePersonalAllowance,
  calculateStartingRateForSavingsBand,
  determineSavingsPSABand,
  calculatePersonalSavingsAllowance,
  applySavingsAllowances,
  applyDividendAllowance,
  resolveIncomeAllowances,
  resolveAllowancesFromIncome
};