/**
 * projection-engine.js
 *
 * Pure UK retirement projection engine.
 * No DOM, no side effects, no global state.
 * Safe to run in a Web Worker and in Node test contexts.
 *
 * Entry point: runProjection(inputs) → ProjectionRow[]
 *
 * Key design decisions vs the monolith:
 * - CGT exempt amount tracked per-person per-year (YearState) so it cannot
 *   be double-used across bed-and-ISA and spending-draw CGT (Priority 1 fix).
 * - Woody GIA balance correctly reduced after bed-and-ISA GIA→ISA transfer
 *   (bug present in monolith: woodyBal.GIA was never decremented).
 * - Tax bands passed as a config object (TaxBands) so uprating is handled
 *   cleanly via uprateBands() rather than five separate effX variables.
 * - BNI CGT uses nonSavingsIncome = 0 approximation (same as monolith —
 *   Priority 2 fix deferred to two-pass loop phase).
 */

'use strict';

import { calcIncomeTax, calcCGT, qmmfEffectiveRate, computeUprateFactor, uprateBands } from './tax-engine.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @typedef {import('./inputs.js').ProjectionInputs} ProjectionInputs
 */

/**
 * @typedef {Object} ProjectionRow
 * @property {number} year
 * @property {number} woodyAge
 * @property {number} heidiAge
 * @property {number} woodySP          Nominal State Pension drawn this year (£)
 * @property {number} heidiSP
 * @property {number} heidiSalInc      Nominal salary drawn this year (£)
 * @property {number} spendingTarget   Nominal spending target (£)
 * @property {number} spendingMultiplier  1.0 or (1 − stepDownPct/100) from age 75
 * @property {number} uprateFactor     Tax threshold uprating factor
 * @property {number} bniCGTBill       CGT triggered by bed-and-ISA transfers (£)
 * @property {number} qmmfDrawActual   Total QMMF draw this year (£)
 * @property {number} qmmfInterestDrawn
 * @property {number} qmmfPrincipalDrawn
 * @property {number} cashDrawn        Total cash drawn (£)
 * @property {{ Cash:number, QMMF:number, GIA:number, SIPP:number, ISA:number, sippTaxable:number }} woodyDrawn
 * @property {{ Cash:number, GIA:number, SIPP:number, ISA:number, sippTaxable:number }}              heidiDrawn
 * @property {number} woodyTax         Income tax + CGT (£)
 * @property {number} heidiTax
 * @property {number} woodyIncomeTax
 * @property {number} heidiIncomeTax
 * @property {number} woodyCGT         CGT on spending-draw GIA disposals only (£)
 * @property {number} heidiCGT
 * @property {number} woodyTaxInc      Taxable income (non-savings + savings) (£)
 * @property {number} heidiTaxInc
 * @property {number} woodyQmmfInterest  Full QMMF interest (drawn + retained) (£)
 * @property {number} totalPortfolio
 * @property {number} realDeflator     1 / cumInfl
 * @property {number} cumInfl
 * @property {{ woodyCash:number, woodyQMMF:number, woodyGIA:number, woodySIPP:number, woodyISA:number,
 *              heidiCash:number, heidiGIA:number, heidiSIPP:number, heidiISA:number }} snap
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Withdraw from wrappers in order until the needed amount is met.
 * Mutates the balances object. Returns a drawn record.
 *
 * @param {{ [wrapper: string]: number }} balances
 * @param {string[]}  order    Wrapper names in priority order (Cash/QMMF already handled)
 * @param {number}    needed
 * @returns {{ Cash:number, QMMF:number, GIA:number, SIPP:number, ISA:number, sippTaxable:number }}
 */
function withdraw(balances, order, needed) {
  const drawn = { Cash: 0, QMMF: 0, GIA: 0, SIPP: 0, ISA: 0, sippTaxable: 0 };
  let rem = needed;
  for (const w of order) {
    if (rem <= 0) break;
    const avail = balances[w] || 0;
    if (avail <= 0) continue;
    const take  = Math.min(avail, rem);
    drawn[w]   += take;
    balances[w] -= take;
    rem         -= take;
    if (w === 'SIPP') drawn.sippTaxable += take * 0.75;
  }
  return drawn;
}

/**
 * Apply growth to equity-like wrappers and add retained QMMF interest.
 * QMMF earns interest only — growth rate is NOT applied to it.
 * Cash is untouched.
 *
 * @param {{ Cash:number, QMMF:number, GIA:number, SIPP:number, ISA:number }} bal
 * @param {number} growthRate
 * @param {number} qmmfInterestRetained  Interest not drawn this year; added to QMMF balance
 */
function growBalances(bal, growthRate, qmmfInterestRetained) {
  bal.Cash  = bal.Cash  || 0;
  bal.QMMF  = (bal.QMMF || 0) + (qmmfInterestRetained || 0);
  bal.GIA   = (bal.GIA  || 0) * (1 + growthRate);
  bal.SIPP  = (bal.SIPP || 0) * (1 + growthRate);
  bal.ISA   = (bal.ISA  || 0) * (1 + growthRate);
}

/** Sum all wrapper balances for one person. */
function totalBal(bal) {
  return (bal.Cash || 0) + (bal.QMMF || 0) + (bal.GIA || 0) + (bal.SIPP || 0) + (bal.ISA || 0);
}

// ---------------------------------------------------------------------------
// Main engine
// ---------------------------------------------------------------------------

/**
 * Run the full year-by-year retirement projection.
 *
 * Pure function — no DOM access, no global mutations.
 * All state threaded explicitly through the year loop.
 *
 * @param {ProjectionInputs} inputs
 * @returns {ProjectionRow[]}
 */
export function runProjection(inputs) {
  const {
    woodyDOB, heidiDOB,
    startYear, endYear,
    spending,
    heidiSalary, heidiSalaryStopAge,
    woodySPAge, woodySPAmt,
    heidiSPAge, heidiSPAmt,
    growthRate, inflationRate,
    qmmfAnnualRate, qmmfMonthlyDraw,
    withdrawalOrder,
    bedAndISA,
    stepDownPct,
    thresholdMode, thresholdFromYear,
    taxBands,
  } = inputs;

  const ISA_ALLOWANCE  = taxBands.isaAllowance;        // £20,000
  const qmmfRate       = qmmfEffectiveRate(qmmfAnnualRate);
  const qmmfAnnualDraw = qmmfMonthlyDraw * 12;

  // ── Mutable year-loop state ───────────────────────────────────────────────
  // Deep-copy balances so the caller's inputs object is not mutated.
  const woodyBal = { ...inputs.woodyBal };
  const heidiBal = { Cash: 0, ...inputs.heidiBal };  // Heidi has no QMMF

  // GIA cost basis — fall back to current balance if caller provides 0.
  let woodyGIACost = inputs.woodyGIACostBasis > 0 ? inputs.woodyGIACostBasis : woodyBal.GIA;
  let heidiGIACost = inputs.heidiGIACostBasis > 0 ? inputs.heidiGIACostBasis : heidiBal.GIA;

  // Withdrawal orders — filter out Cash and QMMF (pre-handled each year).
  const woodyOrder = withdrawalOrder.woody.filter(w => w !== 'Cash' && w !== 'QMMF');
  const heidiOrder = withdrawalOrder.heidi.filter(w => w !== 'Cash' && w !== 'QMMF');

  // Depletion tracking.
  const startBal = {
    'Woody Cash': woodyBal.Cash, 'Woody QMMF': woodyBal.QMMF,
    'Woody GIA':  woodyBal.GIA,  'Woody SIPP': woodyBal.SIPP,  'Woody ISA': woodyBal.ISA,
    'Heidi Cash': heidiBal.Cash, 'Heidi GIA':  heidiBal.GIA,
    'Heidi SIPP': heidiBal.SIPP, 'Heidi ISA':  heidiBal.ISA,
  };
  const depletions = {};

  let cumInfl = 1;
  /** @type {ProjectionRow[]} */
  const rows = [];

  for (let year = startYear; year <= endYear; year++) {
    const woodyAge = year - woodyDOB;
    const heidiAge = year - heidiDOB;

    // ── Inflation ───────────────────────────────────────────────────────────
    cumInfl *= (1 + inflationRate);
    const realDeflator = 1 / cumInfl;

    // ── Per-year tax bands (frozen or uprated) ──────────────────────────────
    const uprateFactor = computeUprateFactor(
      thresholdMode, year, startYear, thresholdFromYear, cumInfl, inflationRate
    );
    const bands = uprateBands(taxBands, uprateFactor);

    // ── Income sources ──────────────────────────────────────────────────────
    const woodySP     = woodyAge >= woodySPAge ? woodySPAmt * cumInfl : 0;
    const heidiSP     = heidiAge >= heidiSPAge ? heidiSPAmt * cumInfl : 0;
    const heidiSalInc = (heidiSalaryStopAge && heidiAge < heidiSalaryStopAge)
      ? heidiSalary * cumInfl
      : 0;

    // ── Spending target ─────────────────────────────────────────────────────
    const spendingMultiplier = (stepDownPct > 0 && woodyAge >= 75)
      ? 1 - (stepDownPct / 100)
      : 1;
    const target = spending * spendingMultiplier * cumInfl;

    // ── Per-person CGT exempt tracking (Priority 1 fix) ────────────────────
    // Each disposal event in the year deducts from this pool.
    // Both bed-and-ISA and spending-draw CGT share the same annual exempt amount.
    let woodyCGTExemptUsed = 0;
    let heidiCGTExemptUsed = 0;

    // ── Bed-and-ISA transfers ───────────────────────────────────────────────
    let bniCGTBill   = 0;
    let bniCGTUnpaid = 0;

    if (bedAndISA.enabled) {
      // ── Woody GIA → ISA ──
      let woodyISAUsed = 0;
      if (bedAndISA.woodyGIA > 0 && woodyBal.GIA > 0) {
        const transfer  = Math.min(bedAndISA.woodyGIA, woodyBal.GIA, ISA_ALLOWANCE);
        const giaGain   = Math.max(0, woodyBal.GIA - woodyGIACost);
        const gainFrac  = woodyBal.GIA > 0 ? giaGain / woodyBal.GIA : 0;
        const realised  = transfer * gainFrac;

        // Shared exempt amount — deduct from per-person pool.
        const exemptAvail = Math.max(0, bands.cgtExempt - woodyCGTExemptUsed);
        const taxableGain = Math.max(0, realised - exemptAvail);
        woodyCGTExemptUsed += Math.min(realised, bands.cgtExempt - woodyCGTExemptUsed);

        // CGT approximation: nonSavingsIncome = 0 (Priority 2 — deferred).
        const cgt = calcCGT(0, taxableGain, bands);
        bniCGTBill    += cgt;

        // Mutate balances.
        woodyBal.GIA -= transfer;   // fix: missing in monolith
        woodyBal.ISA += transfer;
        woodyISAUsed += transfer;

        // Reduce cost basis proportionally (based on pre-transfer GIA balance).
        const preTxGIA = woodyBal.GIA + transfer;  // reconstruct pre-transfer balance
        const costFrac = preTxGIA > 0 ? transfer / preTxGIA : 1;
        woodyGIACost   = Math.max(0, woodyGIACost * (1 - costFrac));
      }

      // ── Woody QMMF → ISA ──
      if (bedAndISA.woodyQMMF > 0 && woodyBal.QMMF > 0) {
        const remaining = Math.max(0, ISA_ALLOWANCE - woodyISAUsed);
        const transfer  = Math.min(bedAndISA.woodyQMMF, woodyBal.QMMF, remaining);
        // QMMF has no capital gain (interest-only fund).
        woodyBal.QMMF -= transfer;
        woodyBal.ISA  += transfer;
        woodyISAUsed  += transfer;
      }

      // ── Heidi GIA → ISA ──
      if (bedAndISA.heidiGIA > 0 && heidiBal.GIA > 0) {
        const transfer  = Math.min(bedAndISA.heidiGIA, heidiBal.GIA, ISA_ALLOWANCE);
        const giaGain   = Math.max(0, heidiBal.GIA - heidiGIACost);
        const gainFrac  = heidiBal.GIA > 0 ? giaGain / heidiBal.GIA : 0;
        const realised  = transfer * gainFrac;

        const exemptAvail = Math.max(0, bands.cgtExempt - heidiCGTExemptUsed);
        const taxableGain = Math.max(0, realised - exemptAvail);
        heidiCGTExemptUsed += Math.min(realised, bands.cgtExempt - heidiCGTExemptUsed);

        const cgt = calcCGT(0, taxableGain, bands);
        bniCGTBill += cgt;

        heidiBal.GIA -= transfer;
        heidiBal.ISA += transfer;
        const preTxGIA = heidiBal.GIA + transfer;
        const costFrac = preTxGIA > 0 ? transfer / preTxGIA : 1;
        heidiGIACost   = Math.max(0, heidiGIACost * (1 - costFrac));
      }

      // ── Settle CGT bill from Woody's cash ──
      if (bniCGTBill > 0) {
        const fromCash = Math.min(bniCGTBill, woodyBal.Cash || 0);
        woodyBal.Cash -= fromCash;
        bniCGTUnpaid   = bniCGTBill - fromCash;
      }
    }

    // ── QMMF fixed draw ─────────────────────────────────────────────────────
    let qmmfInterestEarned = woodyBal.QMMF * qmmfRate;
    let qmmfDrawActual     = 0;
    let qmmfInterestDrawn  = 0;
    let qmmfPrincipalDrawn = 0;

    if (qmmfAnnualDraw > 0 && woodyBal.QMMF > 0) {
      qmmfDrawActual     = Math.min(qmmfAnnualDraw, woodyBal.QMMF + qmmfInterestEarned);
      qmmfInterestDrawn  = Math.min(qmmfDrawActual, qmmfInterestEarned);
      qmmfPrincipalDrawn = Math.max(0, qmmfDrawActual - qmmfInterestDrawn);
      woodyBal.QMMF     -= qmmfPrincipalDrawn;
      qmmfInterestEarned -= qmmfInterestDrawn;
    }

    // ── Cash draw ───────────────────────────────────────────────────────────
    const guaranteed = woodySP + heidiSP + heidiSalInc + qmmfDrawActual;
    let shortfall    = Math.max(0, target - guaranteed + bniCGTUnpaid);
    let cashDrawn    = 0;

    if (shortfall > 0) {
      const totalCash = (woodyBal.Cash || 0) + (heidiBal.Cash || 0);
      cashDrawn = Math.min(shortfall, totalCash);
      const fromWoody  = Math.min(cashDrawn, woodyBal.Cash || 0);
      woodyBal.Cash   -= fromWoody;
      const fromHeidi  = cashDrawn - fromWoody;
      heidiBal.Cash    = Math.max(0, (heidiBal.Cash || 0) - fromHeidi);
      shortfall       -= cashDrawn;
    }

    // ── Wrapper draws ───────────────────────────────────────────────────────
    const woodyDrawn = withdraw(woodyBal, woodyOrder, shortfall);
    const woodyWrapperDrawn   = woodyDrawn.GIA + woodyDrawn.SIPP + woodyDrawn.ISA;
    const remainingAfterWoody = Math.max(0, shortfall - woodyWrapperDrawn);
    const heidiDrawn = withdraw(heidiBal, heidiOrder, remainingAfterWoody);

    // Annotate total QMMF principal and cash into Woody's drawn record.
    woodyDrawn.QMMF += qmmfPrincipalDrawn;
    woodyDrawn.Cash += cashDrawn;

    // ── QMMF full-year interest (taxable savings income) ────────────────────
    // Retained interest = qmmfInterestEarned (updated above after draw).
    const woodyQmmfInterest = qmmfInterestDrawn + qmmfInterestEarned;

    // ── GIA growth and CGT ──────────────────────────────────────────────────
    const woodyGIABalBefore = woodyBal.GIA || 0;
    const heidiGIABalBefore = heidiBal.GIA || 0;

    // Grow equity-like wrappers; add retained QMMF interest to QMMF balance.
    growBalances(woodyBal, growthRate, qmmfInterestEarned);
    growBalances(heidiBal, growthRate, 0);

    // Increase cost bases by this year's growth (notional distribution rule).
    woodyGIACost += woodyGIABalBefore * growthRate;
    heidiGIACost += heidiGIABalBefore * growthRate;

    // Gain fraction on post-growth GIA balance.
    const woodyGIAGain     = Math.max(0, woodyBal.GIA - woodyGIACost);
    const heidiGIAGain     = Math.max(0, heidiBal.GIA - heidiGIACost);
    const woodyGIAGainFrac = woodyBal.GIA > 0 ? woodyGIAGain / woodyBal.GIA : 0;
    const heidiGIAGainFrac = heidiBal.GIA > 0 ? heidiGIAGain / heidiBal.GIA : 0;

    const woodyGIARealised = woodyDrawn.GIA * woodyGIAGainFrac;
    const heidiGIARealised = heidiDrawn.GIA * heidiGIAGainFrac;

    // Reduce cost basis on disposal (pre-growth balance as denominator).
    if (woodyGIABalBefore > 0 && woodyDrawn.GIA > 0) {
      const costFrac = Math.min(1, woodyDrawn.GIA / woodyGIABalBefore);
      woodyGIACost   = Math.max(0, woodyGIACost * (1 - costFrac));
    }
    if (heidiGIABalBefore > 0 && heidiDrawn.GIA > 0) {
      const costFrac = Math.min(1, heidiDrawn.GIA / heidiGIABalBefore);
      heidiGIACost   = Math.max(0, heidiGIACost * (1 - costFrac));
    }

    // CGT — use per-person exempt pool (Priority 1 fix).
    const woodyExemptForSpend = Math.max(0, bands.cgtExempt - woodyCGTExemptUsed);
    const heidiExemptForSpend = Math.max(0, bands.cgtExempt - heidiCGTExemptUsed);
    const woodyTaxableGain = Math.max(0, woodyGIARealised - woodyExemptForSpend);
    const heidiTaxableGain = Math.max(0, heidiGIARealised - heidiExemptForSpend);

    const woodyCGT = calcCGT(woodySP + woodyDrawn.sippTaxable, woodyTaxableGain, bands);
    const heidiCGT = calcCGT(heidiSP + heidiSalInc + heidiDrawn.sippTaxable, heidiTaxableGain, bands);

    // ── Income tax ──────────────────────────────────────────────────────────
    const woodyNonSavings = woodySP + woodyDrawn.sippTaxable;
    const heidiNonSavings = heidiSP + heidiSalInc + heidiDrawn.sippTaxable;
    const woodySavings    = woodyQmmfInterest;
    const heidiSavings    = 0;
    const woodyDividends  = 0;
    const heidiDividends  = 0;

    const woodyIncomeTax = calcIncomeTax(woodyNonSavings, woodySavings, woodyDividends, bands);
    const heidiIncomeTax = calcIncomeTax(heidiNonSavings, heidiSavings, heidiDividends, bands);
    const woodyTaxInc    = woodyNonSavings + woodySavings;
    const heidiTaxInc    = heidiNonSavings + heidiSavings;
    const woodyTax       = woodyIncomeTax + woodyCGT;
    const heidiTax       = heidiIncomeTax + heidiCGT;

    // ── Depletion tracking ──────────────────────────────────────────────────
    const checkMap = {
      'Woody Cash': woodyBal.Cash, 'Woody QMMF': woodyBal.QMMF,
      'Woody GIA':  woodyBal.GIA,  'Woody SIPP': woodyBal.SIPP, 'Woody ISA': woodyBal.ISA,
      'Heidi Cash': heidiBal.Cash, 'Heidi GIA':  heidiBal.GIA,
      'Heidi SIPP': heidiBal.SIPP, 'Heidi ISA':  heidiBal.ISA,
    };
    for (const [key, bal] of Object.entries(checkMap)) {
      if (!depletions[key] && startBal[key] > 0 && bal <= 0) {
        depletions[key] = { year, age: year - (key.startsWith('Woody') ? woodyDOB : heidiDOB) };
      }
    }

    rows.push({
      year, woodyAge, heidiAge,
      woodySP, heidiSP, heidiSalInc,
      spendingTarget: target, spendingMultiplier, uprateFactor,
      bniCGTBill,
      qmmfDrawActual, qmmfInterestDrawn, qmmfPrincipalDrawn, cashDrawn,
      woodyDrawn: { ...woodyDrawn },
      heidiDrawn: { ...heidiDrawn },
      woodyTax, heidiTax, woodyTaxInc, heidiTaxInc,
      woodyIncomeTax, heidiIncomeTax, woodyCGT, heidiCGT,
      woodyQmmfInterest,
      totalPortfolio: totalBal(woodyBal) + totalBal(heidiBal),
      realDeflator, cumInfl,
      snap: {
        woodyCash: woodyBal.Cash, woodyQMMF: woodyBal.QMMF,
        woodyGIA:  woodyBal.GIA,  woodySIPP: woodyBal.SIPP, woodyISA: woodyBal.ISA,
        heidiCash: heidiBal.Cash, heidiGIA:  heidiBal.GIA,
        heidiSIPP: heidiBal.SIPP, heidiISA:  heidiBal.ISA,
      },
    });
  }

  return rows;
}
