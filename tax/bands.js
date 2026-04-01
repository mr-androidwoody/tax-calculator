// tax/bands.js

/**
 * Helpers for applying UK tax bands to taxable slices.
 *
 * Conventions:
 * - "usedBasicBand" and "usedHigherBand" refer to prior taxable income
 *   already occupying those bands.
 * - The function taxes the next category in ordering sequence.
 */

function positiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
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
    policy.incomeTax.basicRateLimit - basicUsed
  );

  const fullHigherBandWidth =
    (policy.incomeTax.higherRateLimit - policy.incomeTax.personalAllowance) -
    policy.incomeTax.basicRateLimit;

  const higherBandCapacity = Math.max(
    0,
    fullHigherBandWidth - higherUsed
  );

  const basicPortion = Math.min(taxableAmount, basicBandCapacity);
  const afterBasic = taxableAmount - basicPortion;

  const higherPortion = Math.min(afterBasic, higherBandCapacity);
  const additionalPortion = Math.max(0, afterBasic - higherPortion);

  const tax = (
    basicPortion * rates.basic +
    higherPortion * rates.higher +
    additionalPortion * rates.additional
  );

  return {
    amount: taxableAmount,
    tax,
    basicPortion,
    higherPortion,
    additionalPortion,
    endingBandUsage: {
      basic: basicUsed + basicPortion,
      higher: higherUsed + higherPortion
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
  const exemptAmount = policy.capitalGains.annualExemptAmount;
  const exemptUsed = Math.min(grossGains, exemptAmount);
  const gainsAfterExemption = grossGains - exemptUsed;

  const taxableIncome = positiveNumber(taxableIncomeBeforeGains);
  const unusedBasicBand = Math.max(
    0,
    policy.incomeTax.basicRateLimit - Math.min(policy.incomeTax.basicRateLimit, taxableIncome)
  );

  const basicRatePortion = Math.min(gainsAfterExemption, unusedBasicBand);
  const higherRatePortion = Math.max(0, gainsAfterExemption - basicRatePortion);

  const tax = (
    basicRatePortion * policy.capitalGains.rates.basic +
    higherRatePortion * policy.capitalGains.rates.higher
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
 * @param {number} taxableIncome
 * @param {object} policy
 * @returns {'none'|'basic'|'higher'|'additional'}
 */
export function determineMarginalIncomeBand(taxableIncome, policy) {
  const income = positiveNumber(taxableIncome);

  if (income <= 0) {
    return 'none';
  }

  if (income <= policy.incomeTax.basicRateLimit) {
    return 'basic';
  }

  const higherRateCeiling =
    policy.incomeTax.higherRateLimit - policy.incomeTax.personalAllowance;

  if (income <= higherRateCeiling) {
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