// tax/classify-income.js

/**
 * Utilities for classifying and normalising annual income inputs.
 *
 * Supported categories:
 * - nonSavings: pensions, state pension, DB, employment/self-employment, other taxable
 * - savings: QMMF / GIA interest, cash interest
 * - dividends: dividend income
 * - capitalGains: manual passive input only
 */

function toAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

/**
 * Normalised shape expected by the tax engine.
 *
 * @param {object} rawIncome
 * @returns {{
 *   nonSavings: {
 *     statePension: number,
 *     dbPension: number,
 *     pensionDrawdown: number,
 *     employment: number,
 *     selfEmployment: number,
 *     otherTaxable: number
 *   },
 *   savings: {
 *     qmmfInterest: number,
 *     cashInterest: number,
 *     otherSavings: number
 *   },
 *   dividends: {
 *     dividends: number
 *   },
 *   capitalGains: {
 *     taxableGains: number
 *   }
 * }}
 */
export function normaliseIncome(rawIncome = {}) {
  const nonSavings = {
    statePension: toAmount(rawIncome?.statePension),
    dbPension: toAmount(rawIncome?.dbPension),
    pensionDrawdown: toAmount(rawIncome?.pensionDrawdown),
    employment: toAmount(rawIncome?.employment),
    selfEmployment: toAmount(rawIncome?.selfEmployment),
    otherTaxable: toAmount(rawIncome?.otherTaxable)
  };

  const savings = {
    qmmfInterest: toAmount(rawIncome?.qmmfInterest),
    cashInterest: toAmount(rawIncome?.cashInterest),
    otherSavings: toAmount(rawIncome?.otherSavings)
  };

  const dividends = {
    dividends: toAmount(rawIncome?.dividends)
  };

  const capitalGains = {
    taxableGains: toAmount(rawIncome?.taxableGains)
  };

  return {
    nonSavings,
    savings,
    dividends,
    capitalGains
  };
}

export function totalNonSavingsIncome(income = {}) {
  const data = normaliseIncome(income);
  return Object.values(data.nonSavings).reduce((sum, value) => sum + value, 0);
}

export function totalSavingsIncome(income = {}) {
  const data = normaliseIncome(income);
  return Object.values(data.savings).reduce((sum, value) => sum + value, 0);
}

export function totalDividendIncome(income = {}) {
  const data = normaliseIncome(income);
  return data.dividends.dividends;
}

export function totalCapitalGains(income = {}) {
  const data = normaliseIncome(income);
  return data.capitalGains.taxableGains;
}

export function summariseIncomeByType(income = {}) {
  const data = normaliseIncome(income);

  return {
    nonSavings: totalNonSavingsIncome(data),
    savings: totalSavingsIncome(data),
    dividends: totalDividendIncome(data),
    capitalGains: totalCapitalGains(data)
  };
}

export function getAdjustedNetIncome(income = {}) {
  // Step 1 planner scope:
  // no Gift Aid / relief-at-source / trade losses etc.
  // ANI is therefore just the sum of taxable income categories before allowances.
  const totals = summariseIncomeByType(income);

  return (
    totals.nonSavings +
    totals.savings +
    totals.dividends
  );
}

export default {
  normaliseIncome,
  totalNonSavingsIncome,
  totalSavingsIncome,
  totalDividendIncome,
  totalCapitalGains,
  summariseIncomeByType,
  getAdjustedNetIncome
};