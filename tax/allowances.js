/**
 * Personal Allowance with tapering
 */
export function calculatePersonalAllowance(totalIncome, policy) {
  const pa = policy.personalAllowance.amount;
  const taperThreshold = policy.personalAllowance.taperThreshold;
  const taperRate = policy.personalAllowance.taperRate;

  if (totalIncome <= taperThreshold) return pa;

  const reduction = (totalIncome - taperThreshold) * taperRate;
  return Math.max(0, pa - reduction);
}

/**
 * Allocate PA to income in correct order:
 * non-savings → savings → dividends
 */
export function allocatePersonalAllowance(income, pa) {
  let remainingPA = pa;

  const use = (amount) => {
    const used = Math.min(amount, remainingPA);
    remainingPA -= used;
    return amount - used;
  };

  const nonSavings = use(income.nonSavings || 0);
  const savings = use(income.savings || 0);
  const dividends = use(income.dividends || 0);

  return {
    remainingPA,
    taxableNonSavings: nonSavings,
    taxableSavings: savings,
    taxableDividends: dividends
  };
}

/**
 * Starting Rate for Savings (max £5k reduced by non-savings income over PA)
 */
export function calculateStartingRateForSavingsBand(
  taxableNonSavingsAfterPA,
  policy
) {
  const maxBand = policy.savings.startingRateLimit;

  const reduction = Math.max(0, taxableNonSavingsAfterPA);
  return Math.max(0, maxBand - reduction);
}

/**
 * Determine PSA band based on total taxable income
 */
export function determineSavingsPSABand(
  taxableNonSavingsAfterPA,
  taxableSavingsAfterStartingRate,
  policy
) {
  const total =
    Math.max(0, taxableNonSavingsAfterPA) +
    Math.max(0, taxableSavingsAfterStartingRate);

  const basic = policy.incomeTax.basicRateLimit;
  const higher = policy.incomeTax.higherRateLimit;

  if (total <= basic) return 'basic';
  if (total <= higher) return 'higher';
  return 'additional';
}

/**
 * PSA amount
 */
export function calculatePersonalSavingsAllowance(psaBand, policy) {
  return policy.savings.personalSavingsAllowance[psaBand] || 0;
}

/**
 * Apply savings allowances in correct order:
 * 1. Starting rate
 * 2. PSA
 */
export function applySavingsAllowances(
  taxableSavingsAfterPA,
  taxableNonSavingsAfterPA,
  policy
) {
  const startingRateBand = calculateStartingRateForSavingsBand(
    taxableNonSavingsAfterPA,
    policy
  );

  const startingRateUsed = Math.min(
    taxableSavingsAfterPA,
    startingRateBand
  );

  const remainingSavings =
    taxableSavingsAfterPA - startingRateUsed;

  const psaBand = determineSavingsPSABand(
    taxableNonSavingsAfterPA,
    remainingSavings,
    policy
  );

  const psaAvailable = calculatePersonalSavingsAllowance(
    psaBand,
    policy
  );

  const psaUsed = Math.min(remainingSavings, psaAvailable);

  return {
    startingRateBandAvailable: startingRateBand,
    startingRateUsed,
    psaBand,
    psaAvailable,
    psaUsed,
    taxableSavingsAfterAllowances:
      remainingSavings - psaUsed
  };
}

/**
 * Dividend allowance
 */
export function applyDividendAllowance(
  taxableDividendsAfterPA,
  policy
) {
  const allowance = policy.dividends.allowance;
  const used = Math.min(taxableDividendsAfterPA, allowance);

  return {
    allowance,
    used,
    taxableDividendsAfterAllowance:
      taxableDividendsAfterPA - used
  };
}

/**
 * Main resolver used by annual-tax.js
 */
export function resolveIncomeAllowances(totals, policy) {
  const totalIncome =
    (totals.nonSavings || 0) +
    (totals.savings || 0) +
    (totals.dividends || 0);

  const personalAllowance = calculatePersonalAllowance(
    totalIncome,
    policy
  );

  const paAllocated = allocatePersonalAllowance(
    totals,
    personalAllowance
  );

  const savings = applySavingsAllowances(
    paAllocated.taxableSavings,
    paAllocated.taxableNonSavings,
    policy
  );

  const dividends = applyDividendAllowance(
    paAllocated.taxableDividends,
    policy
  );

  return {
    personalAllowance,
    ...paAllocated,
    savings,
    dividends
  };
}