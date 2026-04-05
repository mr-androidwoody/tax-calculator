/**
 * tax-engine.js
 *
 * Pure UK income tax and CGT calculation functions.
 * No DOM, no side effects, no global state.
 * Safe to import in Web Worker and Node test contexts.
 *
 * All functions accept a TaxBands config object (from constants.js) so
 * the engine is not tied to any particular tax year.
 */

'use strict';

/**
 * @typedef {import('./constants.js').TaxBands} TaxBands
 */

// ---------------------------------------------------------------------------
// Income tax
// ---------------------------------------------------------------------------

/**
 * Calculate UK income tax for a single individual for one tax year.
 *
 * Income is layered in the standard HMRC order:
 *   non-savings → savings → dividends
 *
 * Allowances applied in order:
 *   1. Personal Allowance (tapered above £100k)
 *   2. Starting Rate for Savings (0% on up to £5k savings, eroded by non-savings above PA)
 *   3. Personal Savings Allowance (£1k basic / £500 higher / £0 additional)
 *   4. Dividend Allowance (£500 at 0%)
 *
 * Each income type is then taxed at its applicable rates, stacking upward
 * through the band structure from the bottom.
 *
 * @param {number}    nonSavings  State Pension + SIPP UFPLS taxable (75%) + employment
 * @param {number}    savings     Interest income (QMMF, bank, bonds)
 * @param {number}    dividends   Dividend income (GIA distributing funds)
 * @param {TaxBands}  bands       Tax year configuration
 * @returns {number}              Income tax due (£)
 */
export function calcIncomeTax(nonSavings, savings, dividends, bands) {
  nonSavings = nonSavings || 0;
  savings    = savings    || 0;
  dividends  = dividends  || 0;

  const totalIncome = nonSavings + savings + dividends;
  if (totalIncome <= 0) return 0;

  // ── Personal Allowance ────────────────────────────────────────────────────
  // Tapers £1 for every £2 of adjusted net income above £100k.
  const pa = totalIncome > bands.taperStart
    ? Math.max(0, bands.PA - Math.floor((totalIncome - bands.taperStart) / 2))
    : bands.PA;

  // PA offsets income in statutory order: non-savings first, then savings, then dividends.
  let paRem = pa;
  const nsNet  = Math.max(0, nonSavings - paRem); paRem = Math.max(0, paRem - nonSavings);
  const savNet = Math.max(0, savings    - paRem); paRem = Math.max(0, paRem - savings);
  const divNet = Math.max(0, dividends  - paRem);

  // ── Starting Rate for Savings ─────────────────────────────────────────────
  // 0% on up to £5,000 of savings income, but eroded £1-for-£1 by non-savings
  // income that falls above the PA. If non-savings fills the entire PA, the
  // full SRS band is available for savings.
  const srsAvail    = Math.max(0, bands.SRS - nsNet);
  const srsCover    = Math.min(savNet, srsAvail);
  const savAfterSRS = savNet - srsCover;

  // ── Personal Savings Allowance ────────────────────────────────────────────
  // Tier determined by which rate band total income falls into (gross, pre-PA).
  const psa = totalIncome <= bands.basicLimit      ? bands.PSA_basic
            : totalIncome <= bands.additionalThreshold ? bands.PSA_higher
            : 0;
  const psaCover   = Math.min(savAfterSRS, psa);
  const savTaxable = savAfterSRS - psaCover;

  // ── Dividend Allowance ────────────────────────────────────────────────────
  const divTaxable = Math.max(0, divNet - bands.dividendAllowance);

  // ── Band arithmetic ───────────────────────────────────────────────────────
  // basicBand = the width of the 20% band after the PA.
  // Each income type stacks above the previous one in the band structure.
  const basicBand = bands.basicLimit - bands.PA;

  // Non-savings tax
  let nsTax = 0;
  {
    let r = nsNet;
    const b = Math.min(r, basicBand);
    nsTax += b * bands.basicRate; r -= b;
    if (r > 0) {
      const h = Math.min(r, bands.additionalThreshold - bands.basicLimit);
      nsTax += h * bands.higherRate; r -= h;
      if (r > 0) nsTax += r * bands.additionalRate;
    }
  }

  // Savings tax — stacks above non-savings in the band
  let savTax = 0;
  if (savTaxable > 0) {
    let r = savTaxable;
    const bLeft = Math.max(0, basicBand - nsNet);
    const b = Math.min(r, bLeft);
    savTax += b * bands.basicRate; r -= b;
    if (r > 0) {
      const hLeft = Math.max(0, (bands.additionalThreshold - bands.PA) - nsNet - b);
      const h = Math.min(r, hLeft);
      savTax += h * bands.higherRate; r -= h;
      if (r > 0) savTax += r * bands.additionalRate;
    }
  }

  // Dividend tax — stacks above savings in the band (special dividend rates)
  let divTax = 0;
  if (divTaxable > 0) {
    let r = divTaxable;
    const used = nsNet + savTaxable;
    const bLeft = Math.max(0, basicBand - used);
    const b = Math.min(r, bLeft);
    divTax += b * 0.0875; r -= b;
    if (r > 0) {
      const hLeft = Math.max(0, (bands.additionalThreshold - bands.PA) - used - b);
      const h = Math.min(r, hLeft);
      divTax += h * 0.3375; r -= h;
      if (r > 0) divTax += r * 0.3935;
    }
  }

  return nsTax + savTax + divTax;
}

// ---------------------------------------------------------------------------
// CGT
// ---------------------------------------------------------------------------

/**
 * Calculate CGT on a taxable capital gain for one individual for one tax year.
 *
 * UK investment CGT rules (2026/27):
 * - 18% on gains that fall within the unused basic rate band
 * - 24% on gains above the basic rate band
 *
 * Gains stack on top of income. The basic rate band space available to gains
 * is determined by how much non-savings income (after PA) has already consumed
 * the band. Savings income is not included here — HMRC stacks gains above
 * non-savings but savings income itself fills the band before gains.
 *
 * The CGT annual exempt amount should be deducted BEFORE calling this function.
 * The caller is responsible for tracking exempt amount usage across multiple
 * disposal events in the same year (see YearState.cgtExemptUsed).
 *
 * @param {number}   nonSavingsIncome  Non-savings income for the year (post any adjustments)
 * @param {number}   taxableGain       Gain after exempt amount — must be >= 0
 * @param {TaxBands} bands             Tax year configuration
 * @returns {number}                   CGT due (£)
 */
export function calcCGT(nonSavingsIncome, taxableGain, bands) {
  if (taxableGain <= 0) return 0;

  const pa             = Math.min(bands.PA, nonSavingsIncome);
  const incomeAfterPA  = Math.max(0, nonSavingsIncome - pa);
  const basicBand      = bands.basicLimit - bands.PA;
  const basicUsed      = Math.min(incomeAfterPA, basicBand);
  const basicRemaining = Math.max(0, basicBand - basicUsed);

  const atBasic  = Math.min(taxableGain, basicRemaining);
  const atHigher = taxableGain - atBasic;

  return atBasic * bands.cgtBasicRate + atHigher * bands.cgtHigherRate;
}

// ---------------------------------------------------------------------------
// QMMF effective annual rate
// ---------------------------------------------------------------------------

/**
 * Convert a nominal annual percentage rate to an effective annual rate,
 * assuming daily compounding (money market fund convention).
 *
 * @param {number} annualPct  Nominal rate as a percentage (e.g. 3.8 for 3.8%)
 * @returns {number}          Effective annual rate as a decimal (e.g. 0.038731)
 */
export function qmmfEffectiveRate(annualPct) {
  const daily = annualPct / 100 / 365;
  return Math.pow(1 + daily, 365) - 1;
}

// ---------------------------------------------------------------------------
// Threshold uprating
// ---------------------------------------------------------------------------

/**
 * Compute the uprate factor for tax thresholds given the current year,
 * cumulative inflation, and the uprating mode.
 *
 * @param {'frozen'|'fromYear'|'always'} mode
 * @param {number} year               Current projection year
 * @param {number} startYear          Projection start year
 * @param {number} thresholdFromYear  Year uprating begins (only used in 'fromYear' mode)
 * @param {number} cumInfl            Cumulative inflation factor at this year (e.g. 1.025)
 * @param {number} inflationRate      Annual inflation rate as decimal (e.g. 0.025)
 * @returns {number}                  Uprate factor (1.0 = frozen, >1.0 = uprated)
 */
export function computeUprateFactor(mode, year, startYear, thresholdFromYear, cumInfl, inflationRate) {
  if (mode === 'always') {
    return cumInfl;
  }
  if (mode === 'fromYear' && year >= thresholdFromYear) {
    // Inflation accumulated only from thresholdFromYear onward.
    const yearsBeforeUnfreeze = thresholdFromYear - startYear;
    return cumInfl / Math.pow(1 + inflationRate, yearsBeforeUnfreeze);
  }
  return 1;
}

/**
 * Apply an uprate factor to a TaxBands object, returning a new object
 * with all monetary thresholds scaled accordingly. Rates (%) are unchanged.
 *
 * @param {TaxBands} bands
 * @param {number}   factor
 * @returns {TaxBands}
 */
export function uprateBands(bands, factor) {
  if (factor === 1) return bands;
  return {
    ...bands,
    PA:                  bands.PA                  * factor,
    taperStart:          bands.taperStart           * factor,
    basicLimit:          bands.basicLimit           * factor,
    additionalThreshold: bands.additionalThreshold  * factor,
    SRS:                 bands.SRS                  * factor,
    PSA_basic:           bands.PSA_basic            * factor,
    PSA_higher:          bands.PSA_higher           * factor,
    dividendAllowance:   bands.dividendAllowance    * factor,
    cgtExempt:           bands.cgtExempt            * factor,
    isaAllowance:        bands.isaAllowance,  // ISA allowance is policy, not inflation-linked
  };
}
