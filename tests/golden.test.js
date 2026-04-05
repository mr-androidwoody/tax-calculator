/**
 * golden.test.js
 *
 * End-to-end golden scenario tests for runProjection().
 * Run with: node --test tests/golden.test.js
 *
 * Scenario: Preload baseline, bed-and-ISA disabled, frozen thresholds.
 * All expected values hand-verified in HANDOVER.md session notes.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { defaultInputs } from '../js/inputs.js';
import { runProjection } from '../js/projection-engine.js';

const inputs = defaultInputs();
const rows = runProjection(inputs);
const r = rows[0]; // year 2026

// Tolerance helpers
const penny   = n => Math.round(n * 100) / 100;
const nearest = n => Math.round(n);
const within  = (actual, expected, tol = 1) =>
  Math.abs(actual - expected) <= tol;

// ---------------------------------------------------------------------------
// Year 1 (2026) — inflation and income
// ---------------------------------------------------------------------------

describe('golden year 1 — inflation and income', () => {
  it('cumInfl is 1.025', () => {
    assert.ok(within(r.cumInfl, 1.025, 0.0001), `got ${r.cumInfl}`);
  });

  it('spendingTarget is £46,125', () => {
    assert.equal(nearest(r.spendingTarget), 46_125);
  });

  it('heidiSalInc is £15,375', () => {
    assert.equal(nearest(r.heidiSalInc), 15_375);
  });

  it('woodySP is £0 (age 58, below SP age 67)', () => {
    assert.equal(r.woodySP, 0);
  });

  it('heidiSP is £0 (age 59, below SP age 67)', () => {
    assert.equal(r.heidiSP, 0);
  });
});

// ---------------------------------------------------------------------------
// Year 1 — QMMF draw
// ---------------------------------------------------------------------------

describe('golden year 1 — QMMF draw', () => {
  it('qmmfDrawActual is £15,996 (12 × £1,333)', () => {
    assert.equal(nearest(r.qmmfDrawActual), 15_996);
  });

  it('qmmfInterestDrawn is £15,996 (draw fully covered by interest)', () => {
    assert.equal(nearest(r.qmmfInterestDrawn), 15_996);
  });

  it('qmmfPrincipalDrawn is £0', () => {
    assert.equal(r.qmmfPrincipalDrawn, 0);
  });

  it('woodyQmmfInterest is ~£17,429 (full year interest, drawn + retained)', () => {
    assert.ok(within(r.woodyQmmfInterest, 17_429, 1), `got ${r.woodyQmmfInterest}`);
  });
});

// ---------------------------------------------------------------------------
// Year 1 — cash and wrapper draws
// ---------------------------------------------------------------------------

describe('golden year 1 — cash and wrapper draws', () => {
  it('cashDrawn is £14,754 (shortfall after QMMF + salary covers spending)', () => {
    assert.equal(nearest(r.cashDrawn), 14_754);
  });

  it('woodyDrawn.GIA is £0 (cash covers shortfall)', () => {
    assert.equal(r.woodyDrawn.GIA, 0);
  });

  it('woodyDrawn.SIPP is £0', () => {
    assert.equal(r.woodyDrawn.SIPP, 0);
  });

  it('woodyDrawn.ISA is £0', () => {
    assert.equal(r.woodyDrawn.ISA, 0);
  });
});

// ---------------------------------------------------------------------------
// Year 1 — tax
// ---------------------------------------------------------------------------

describe('golden year 1 — tax', () => {
  it('woodyIncomeTax is £0 (£17,429 savings sheltered by PA + SRS)', () => {
    assert.equal(penny(r.woodyIncomeTax), 0);
  });

  it('heidiIncomeTax is £561 (£2,805 × 20%)', () => {
    assert.equal(penny(r.heidiIncomeTax), 561);
  });

  it('woodyCGT is £0 (no GIA disposal)', () => {
    assert.equal(r.woodyCGT, 0);
  });

  it('heidiCGT is £0 (no GIA disposal)', () => {
    assert.equal(r.heidiCGT, 0);
  });

  it('bniCGTBill is £0 (BNI disabled)', () => {
    assert.equal(r.bniCGTBill, 0);
  });
});

// ---------------------------------------------------------------------------
// Year 1 — end-of-year balances
// ---------------------------------------------------------------------------

describe('golden year 1 — end-of-year balances', () => {
  it('snap.woodyCash is £55,246 (£70,000 − £14,754)', () => {
    assert.equal(nearest(r.snap.woodyCash), 55_246);
  });

  it('snap.woodyQMMF is ~£451,433 (£450,000 + £1,433 retained interest)', () => {
    assert.ok(within(r.snap.woodyQMMF, 451_433, 1), `got ${r.snap.woodyQMMF}`);
  });

  it('snap.woodyGIA is £159,000 (£150,000 × 1.06)', () => {
    assert.equal(nearest(r.snap.woodyGIA), 159_000);
  });

  it('snap.woodySIPP is £477,000 (£450,000 × 1.06)', () => {
    assert.equal(nearest(r.snap.woodySIPP), 477_000);
  });

  it('snap.woodyISA is £265,000 (£250,000 × 1.06)', () => {
    assert.equal(nearest(r.snap.woodyISA), 265_000);
  });

  it('snap.heidiGIA is £5,300 (£5,000 × 1.06)', () => {
    assert.equal(nearest(r.snap.heidiGIA), 5_300);
  });

  it('snap.heidiSIPP is £212,000 (£200,000 × 1.06)', () => {
    assert.equal(nearest(r.snap.heidiSIPP), 212_000);
  });

  it('snap.heidiISA is £159,000 (£150,000 × 1.06)', () => {
    assert.equal(nearest(r.snap.heidiISA), 159_000);
  });

  it('totalPortfolio is ~£1,783,979', () => {
    assert.ok(within(r.totalPortfolio, 1_783_979, 1), `got ${r.totalPortfolio}`);
  });
});

// ---------------------------------------------------------------------------
// Projection length sanity
// ---------------------------------------------------------------------------

describe('projection length', () => {
  it('produces one row per year from 2026 to 2060', () => {
    assert.equal(rows.length, 2060 - 2026 + 1);
  });

  it('first row is year 2026', () => {
    assert.equal(rows[0].year, 2026);
  });

  it('last row is year 2060', () => {
    assert.equal(rows[rows.length - 1].year, 2060);
  });
});
