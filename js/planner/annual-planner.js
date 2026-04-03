// js/planner/annual-planner.js
//
// Phase 2: deterministic single-year annual planner.
//
// Responsibilities:
//   1. Accept structured planner inputs (income + targets + assets)
//   2. Estimate existing net income using the tax engine as a black box
//   3. Iteratively solve for exact gross withdrawals needed to hit net target
//   4. Apply UFPLS rules to pension withdrawals (25% tax-free, 75% taxable)
//   5. Return a tax-engine-ready income payload plus planner metadata
//
// This file contains NO tax logic. It calls calculateAnnualTaxCompact as a
// black-box oracle for net income estimation only.
//
// Funding order (Phase 2, hardcoded):
//   1. Existing income (already present in income object)
//   2. Cash / QMMF interest
//   3. Pension drawdown (UFPLS: 25% tax-free, 75% pensionDrawdown)
//   4. GIA dividends
//   ISA is ignored for tax and not drawn in Phase 2.
//
// Gross-up approach:
//   Iterative bisection against the tax engine.
//   No fixed factors. Each source is solved exactly given the income already
//   stacked beneath it in the funding order.

import { calculateAnnualTaxCompact } from '../../tax/annual-tax.js';

// ─── constants ───────────────────────────────────────────────────────────────

// UFPLS: 25% of each pension withdrawal is tax-free, 75% is taxable income.
const UFPLS_TAXABLE_FRACTION = 0.75;
const UFPLS_TAX_FREE_FRACTION = 0.25;

// Bisection solver settings. 200 iterations converges to sub-penny on any
// realistic income range (<£5M). Tolerance is £0.01 net.
const BISECT_MAX_ITER = 200;
const BISECT_TOLERANCE = 0.01;

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Top-level orchestrator. Processes all people and assembles both the planner
 * summary and the tax-engine-ready payload.
 *
 * @param {object} plannerInput
 * @param {Array<{
 *   id: string,
 *   name: string,
 *   income: object,
 *   targets: { netIncomeTarget: number },
 *   assets: { cash: number, gia: number, isa: number, pension: number }
 * }>} plannerInput.people
 *
 * @returns {{
 *   planner: { people: Array<PlannerPersonResult> },
 *   taxInput: { people: Array<{ id, name, income }> }
 * }}
 */
export function buildAnnualPlan(plannerInput) {
  const people = Array.isArray(plannerInput?.people) ? plannerInput.people : [];

  const personOutputs = people.map(buildPersonAnnualPlan);

  return {
    planner: {
      people: personOutputs.map((o) => o.plannerPersonResult)
    },
    taxInput: {
      people: personOutputs.map((o) => o.taxPersonInput)
    }
  };
}

/**
 * Processes one person end-to-end.
 *
 * @param {object} personInput
 * @returns {{ plannerPersonResult: object, taxPersonInput: object }}
 */
export function buildPersonAnnualPlan(personInput) {
  const id = String(personInput?.id || '');
  const name = String(personInput?.name || '');
  const income = normaliseIncomeInput(personInput?.income);
  const netIncomeTarget = toAmount(personInput?.targets?.netIncomeTarget);
  const assets = normaliseAssets(personInput?.assets);

  // Step 1: what does existing income deliver net?
  const existingNet = estimateExistingNetIncome(income);

  // Step 2: how much additional net is needed?
  const netShortfall = Math.max(0, netIncomeTarget - existingNet);

  // Step 3: allocate gross withdrawals to cover the shortfall.
  const { withdrawals, generatedIncome } = netShortfall > 0
    ? allocateWithdrawals({ income, assets, netShortfall })
    : emptyAllocation();

  // Step 4: merge existing income with planner-generated flows.
  const plannedIncome = buildTaxIncomeFromPlan(income, generatedIncome);

  // Achieved net is an estimate here; planner-runner.js will overwrite it
  // with the actual tax-engine result after calculateHouseholdTax() runs.
  const achievedNetIncomeEstimate = estimateExistingNetIncome(plannedIncome);

  return {
    plannerPersonResult: {
      id,
      name,
      targetNetIncome: netIncomeTarget,
      existingNetIncome: existingNet,
      // Runner overwrites achievedNetIncome and shortfall with actuals.
      achievedNetIncome: achievedNetIncomeEstimate,
      shortfall: Math.max(0, netIncomeTarget - achievedNetIncomeEstimate),
      withdrawals,
      generatedIncome
    },
    taxPersonInput: {
      id,
      name,
      income: plannedIncome
    }
  };
}

/**
 * Merges existing income with planner-generated flows into a flat income
 * object ready for calculateAnnualTax / calculateHouseholdTax.
 *
 * @param {object} existingIncome  normalised flat income object
 * @param {object} generatedIncome generated income additions from allocateWithdrawals
 * @returns {object} flat income object for tax engine
 */
export function buildTaxIncomeFromPlan(existingIncome, generatedIncome) {
  return {
    statePension: existingIncome.statePension,
    dbPension: existingIncome.dbPension,
    pensionDrawdown: existingIncome.pensionDrawdown + (generatedIncome.pensionDrawdown || 0),
    employment: existingIncome.employment,
    selfEmployment: existingIncome.selfEmployment,
    otherTaxable: existingIncome.otherTaxable,
    qmmfInterest: existingIncome.qmmfInterest + (generatedIncome.qmmfInterest || 0),
    cashInterest: existingIncome.cashInterest + (generatedIncome.cashInterest || 0),
    otherSavings: existingIncome.otherSavings,
    dividends: existingIncome.dividends + (generatedIncome.dividends || 0),
    taxableGains: existingIncome.taxableGains // unchanged in Phase 2
  };
}

/**
 * Returns the net cash income delivered by an income object, using the tax
 * engine as a black box.
 *
 * @param {object} income flat income object
 * @returns {number} net income after all tax
 */
export function estimateExistingNetIncome(income) {
  const result = calculateAnnualTaxCompact(income);
  return result.netAfterAllTax;
}

/**
 * Allocates gross withdrawals across cash → pension → GIA in funding order,
 * using iterative bisection to solve for exact gross amounts.
 *
 * @param {{ income: object, assets: object, netShortfall: number }} params
 * @returns {{ withdrawals: object, generatedIncome: object }}
 */
export function allocateWithdrawals({ income, assets, netShortfall }) {
  const generatedIncome = {
    qmmfInterest: 0,
    cashInterest: 0,
    pensionDrawdown: 0,
    dividends: 0,
    taxableGains: 0
  };

  const withdrawals = {
    cash: 0,
    pension: 0,
    gia: 0
  };

  let remainingNet = netShortfall;

  // ── Stage 1: Cash / QMMF ─────────────────────────────────────────────────
  // Cash interest is savings income. With SRS + PSA it can often be partially
  // or fully tax-free. We allocate cash first since it's cheapest for most
  // people in basic-rate territory.
  //
  // Cap: we won't generate more than the available cash balance in gross terms
  // (interest income is assumed to be drawn from cash balance directly).
  // Phase 2 treats cash funding as generating qmmfInterest for simplicity.

  if (remainingNet > BISECT_TOLERANCE && assets.cash > 0) {
    const maxGross = assets.cash;
    const baseIncome = { ...income };

    const solved = bisectGross({
      baseIncome,
      incomeKey: 'qmmfInterest',
      maxGross,
      netTarget: remainingNet,
      // net delivered by a gross amount from this source:
      netFn: (gross, base) => {
        const trial = buildTaxIncomeFromPlan(base, { ...generatedIncome, qmmfInterest: gross });
        return estimateExistingNetIncome(trial) - estimateExistingNetIncome(base);
      }
    });

    generatedIncome.qmmfInterest = solved.gross;
    withdrawals.cash = solved.gross;
    remainingNet = Math.max(0, remainingNet - solved.netDelivered);
  }

  // ── Stage 2: Pension (UFPLS) ─────────────────────────────────────────────
  // UFPLS: each £1 withdrawn = 25p tax-free + 75p taxable income.
  // The gross withdrawal is the full pension amount taken.
  // Only 75% (pensionDrawdown) enters the tax engine as taxable income.
  // The 25% tax-free component counts toward net income directly.
  //
  // So net delivered by a gross UFPLS withdrawal G is:
  //   net = 0.25*G + (tax engine net on 0.75*G stacked on top of existing income)
  //       - (tax engine net on existing income alone)
  //
  // The bisection oracle below models this correctly.

  if (remainingNet > BISECT_TOLERANCE && assets.pension > 0) {
    const maxGross = assets.pension;
    const baseIncome = buildTaxIncomeFromPlan(income, generatedIncome);

    const solved = bisectGross({
      baseIncome,
      incomeKey: 'pensionDrawdown',
      maxGross,
      netTarget: remainingNet,
      netFn: (gross, base) => {
        const taxablePortion = gross * UFPLS_TAXABLE_FRACTION;
        const taxFreePortion = gross * UFPLS_TAX_FREE_FRACTION;
        const withPension = { ...base, pensionDrawdown: base.pensionDrawdown + taxablePortion };
        const netWith = estimateExistingNetIncome(withPension);
        const netWithout = estimateExistingNetIncome(base);
        // Net gained = tax-free lump + after-tax net on taxable portion
        return taxFreePortion + (netWith - netWithout);
      }
    });

    const taxablePortion = solved.gross * UFPLS_TAXABLE_FRACTION;
    const taxFreePortion = solved.gross * UFPLS_TAX_FREE_FRACTION;

    generatedIncome.pensionDrawdown = taxablePortion;
    generatedIncome.ufplsTaxFree = taxFreePortion; // metadata only, not passed to tax engine
    withdrawals.pension = solved.gross;
    remainingNet = Math.max(0, remainingNet - solved.netDelivered);
  }

  // ── Stage 3: GIA dividends ───────────────────────────────────────────────
  // Phase 2: GIA funding is modelled as dividend income only.
  // No gains logic yet.

  if (remainingNet > BISECT_TOLERANCE && assets.gia > 0) {
    const maxGross = assets.gia;
    const baseIncome = buildTaxIncomeFromPlan(income, generatedIncome);

    const solved = bisectGross({
      baseIncome,
      incomeKey: 'dividends',
      maxGross,
      netTarget: remainingNet,
      netFn: (gross, base) => {
        const withGia = { ...base, dividends: base.dividends + gross };
        return estimateExistingNetIncome(withGia) - estimateExistingNetIncome(base);
      }
    });

    generatedIncome.dividends = solved.gross;
    withdrawals.gia = solved.gross;
    remainingNet = Math.max(0, remainingNet - solved.netDelivered);
  }

  return { withdrawals, generatedIncome };
}

// ─── bisection solver ────────────────────────────────────────────────────────

/**
 * Finds the gross withdrawal amount that delivers exactly netTarget additional
 * net income, given existing base income, using the tax engine as an oracle.
 *
 * Uses bisection (binary search) — guaranteed convergence, no derivative needed.
 *
 * @param {{
 *   baseIncome: object,
 *   incomeKey: string,
 *   maxGross: number,
 *   netTarget: number,
 *   netFn: (gross: number, baseIncome: object) => number
 * }} params
 *
 * @returns {{ gross: number, netDelivered: number }}
 */
function bisectGross({ baseIncome, incomeKey, maxGross, netTarget, netFn }) {
  // Check whether maxGross can even cover the target.
  const maxNet = netFn(maxGross, baseIncome);

  if (maxNet <= netTarget) {
    // This source cannot fully cover the remaining shortfall even at maximum.
    // Use as much as available.
    return { gross: maxGross, netDelivered: maxNet };
  }

  // Bisect to find the gross that delivers exactly netTarget.
  let lo = 0;
  let hi = maxGross;

  for (let i = 0; i < BISECT_MAX_ITER; i++) {
    const mid = (lo + hi) / 2;
    const netMid = netFn(mid, baseIncome);

    if (Math.abs(netMid - netTarget) < BISECT_TOLERANCE) {
      return { gross: mid, netDelivered: netMid };
    }

    if (netMid < netTarget) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const finalGross = (lo + hi) / 2;
  return { gross: finalGross, netDelivered: netFn(finalGross, baseIncome) };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function emptyAllocation() {
  return {
    withdrawals: { cash: 0, pension: 0, gia: 0 },
    generatedIncome: {
      qmmfInterest: 0,
      cashInterest: 0,
      pensionDrawdown: 0,
      dividends: 0,
      taxableGains: 0,
      ufplsTaxFree: 0
    }
  };
}

function toAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function normaliseIncomeInput(raw = {}) {
  return {
    statePension: toAmount(raw?.statePension),
    dbPension: toAmount(raw?.dbPension),
    pensionDrawdown: toAmount(raw?.pensionDrawdown),
    employment: toAmount(raw?.employment),
    selfEmployment: toAmount(raw?.selfEmployment),
    otherTaxable: toAmount(raw?.otherTaxable),
    qmmfInterest: toAmount(raw?.qmmfInterest),
    cashInterest: toAmount(raw?.cashInterest),
    otherSavings: toAmount(raw?.otherSavings),
    dividends: toAmount(raw?.dividends),
    taxableGains: toAmount(raw?.taxableGains)
  };
}

function normaliseAssets(raw = {}) {
  return {
    cash: toAmount(raw?.cash),
    gia: toAmount(raw?.gia),
    isa: toAmount(raw?.isa),
    pension: toAmount(raw?.pension)
  };
}
