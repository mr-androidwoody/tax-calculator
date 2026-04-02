// tax/bands.js

/**
 * Helpers for applying UK tax bands to taxable slices.
 *
 * Conventions:
 * - "usedBasicBand" and "usedHigherBand" refer to prior taxable income
 *   already occupying those bands.
 * - The function taxes the next category in ordering sequence.
 * - Inputs here are taxable amounts after relevant allowances have already
 *   been applied upstream.
 */

function positiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function getBasicRateLimit(policy) {
  return positiveNumber(policy?.incomeTax?.basicRateLimit);
}

function getHigherRateLimit(policy) {
  return positiveNumber(policy?.incomeTax?.higherRateLimit);
}

function getHigherBandWidth(policy) {
  const basicRateLimit = getBasicRateLimit(policy);
  const higherRateLimit = getHigherRateLimit(policy);

  return Math.max(0, higherRateLimit - basicRateLimit);
}

/**
 * Tax an amount across basic / higher / additional bands, given prior usage.
 *
 * @param {object} params
 * @param {number} params.amount
 * @param {number} params.usedBasicBand
 * @param {number} params.usedHigherBand
 * @param {object} params.rates
 * @param {object} policy
 * @returns {{
 *   amount:number,
 *   tax:number,
 *   basicPortion:number,
 *   higherPortion:number,
 *   additionalPortion:number,
 *   endingBandUsage:{basic:number,higher:number}
 * }}
 */
export function taxUsingBands(
  {
    amount,
    usedBasicBand = 0,
    usedHigherBand = 0,
    rates
  },
  policy
) {
  const taxableAmount = positiveNumber(amount);
  const basicUsed = positiveNumber(usedBasicBand);
  const higherUsed = positiveNumber(usedHigherBand);

  const basicBandCapacity = Math.max(
    0,
    getBasicRateLimit(policy) - basicUsed
  );

  const higherBandWidth = getHigherBandWidth(policy);

  const higherBandCapacity = Math.max(
    0,
    higherBandWidth - higherUsed
  );

  const basicPortion = Math.min(taxableAmount, basicBandCapacity);
  const afterBasic = taxableAmount - basicPortion;

  const higherPortion = Math.min(afterBasic, higherBandCapacity);
  const additionalPortion = Math.max(0, afterBasic - higherPortion);

  const tax = (
    basicPortion * positiveNumber(rates?.basic) +
    higherPortion * positiveNumber(rates?.higher) +
    additionalPortion * positiveNumber(rates?.additional)
  );

  const endingBasic = basicUsed + basicPortion;
  const endingHigher = higherUsed + higherPortion;

  return {
    amount: taxableAmount,
    tax,
    basicPortion,
    higherPortion,
    additionalPortion,
    endingBandUsage: {
      basic: endingBasic,
      higher: additionalPortion > 0 ? higherBandWidth : endingHigher
    }
  };
}

/**
 * Tax savings income after savings-specific allowances.
 * Rates are aligned with ordinary income rates for 2026-27.
 *
 * @param {object} params
 * @param {number} params.amount
 * @param {number} params.usedBasicBand
 * @param {number} params.usedHigherBand
 * @param {object} policy
 * @returns {object}
 */
export function taxSavingsIncome(
  {
    amount,
    usedBasicBand = 0,
    usedHigherBand = 0
  },
  policy
) {
  return taxUsingBands(
    {
      amount,
      usedBasicBand,
      usedHigherBand,
      rates: policy.savings.rates
    },
    policy
  );
}

/**
 * Tax dividend income after dividend allowance.
 *
 * @param {object} params
 * @param {number} params.amount
 * @param {number} params.usedBasicBand
 * @param {number} params.usedHigherBand
 * @param {object} policy
 * @returns {object}
 */
export function taxDividendIncome(
  {
    amount,
    usedBasicBand = 0,
    usedHigherBand = 0
  },
  policy
) {
  return taxUsingBands(
    {
      amount,
      usedBasicBand,
      usedHigherBand,
      rates: policy.dividends.rates
    },
    policy
  );
}

/**
 * Passive/manual CGT calculation only.
 *
 * Capital gains are stacked on top of taxable income.
 * We use:
 * - 18% within unused basic-rate band
 * - 24% above that
 *
 * @param {object} params
 * @param {number} params.taxableGains
 * @param {number} params.taxableIncomeBeforeGains
 * @param {object} policy
 * @returns {{
 *   taxableGains:number,
 *   annualExemptAmount:number,
 *   exemptUsed:number,
 *   gainsAfterExemption:number,
 *   basicRatePortion:number,
 *   higherRatePortion:number,
 *   tax:number
 * }}
 */
export function taxCapitalGains(
  {
    taxableGains,
    taxableIncomeBeforeGains = 0
  },
  policy
) {
  const grossGains = positiveNumber(taxableGains);
  const exemptAmount = positiveNumber(policy?.capitalGains?.annualExemptAmount);
  const exemptUsed = Math.min(grossGains, exemptAmount);
  const gainsAfterExemption = grossGains - exemptUsed;

  const taxableIncome = positiveNumber(taxableIncomeBeforeGains);
  const unusedBasicBand = Math.max(
    0,
    getBasicRateLimit(policy) - Math.min(getBasicRateLimit(policy), taxableIncome)
  );

  const basicRatePortion = Math.min(gainsAfterExemption, unusedBasicBand);
  const higherRatePortion = Math.max(0, gainsAfterExemption - basicRatePortion);

  const tax = (
    basicRatePortion * positiveNumber(policy?.capitalGains?.rates?.basic) +
    higherRatePortion * positiveNumber(policy?.capitalGains?.rates?.higher)
  );

  return {
    taxableGains: grossGains,
    annualExemptAmount: exemptAmount,
    exemptUsed,
    gainsAfterExemption,
    basicRatePortion,
    higherRatePortion,
    tax
  };
}

/**
 * Determine top marginal income band occupied by taxable income.
 *
 * Inputs here are taxable income after allowances.
 *
 * @param {number} taxableIncome
 * @param {object} policy
 * @returns {'none'|'basic'|'higher'|'additional'}
 */
export function determineMarginalIncomeBand(taxableIncome, policy) {
  const income = positiveNumber(taxableIncome);
  const basicRateLimit = getBasicRateLimit(policy);
  const higherRateLimit = getHigherRateLimit(policy);

  if (income <= 0) {
    return 'none';
  }

  if (income <= basicRateLimit) {
    return 'basic';
  }

  if (income <= higherRateLimit) {
    return 'higher';
  }

  return 'additional';
}

export default {
  taxUsingBands,
  taxSavingsIncome,
  taxDividendIncome,
  taxCapitalGains,
  determineMarginalIncomeBand
};