/**
 * constants.js
 *
 * Tax band configuration objects, wrapper constants, and preload values.
 * Update TAX_BANDS each April — pass the appropriate object into the engine
 * rather than importing TAX_CURRENT directly, so tests can pin a specific year.
 *
 * No DOM dependencies. Safe to import in Web Worker context.
 */

'use strict';

// ---------------------------------------------------------------------------
// Tax band configuration — updateable each April
// ---------------------------------------------------------------------------

/** @typedef {Object} TaxBands
 * @property {string}  year
 * @property {number}  PA                   Personal Allowance
 * @property {number}  taperStart           PA taper start (£100k)
 * @property {number}  basicLimit           Top of basic rate band (£50,270)
 * @property {number}  additionalThreshold  Top of higher rate band (£125,140)
 * @property {number}  basicRate
 * @property {number}  higherRate
 * @property {number}  additionalRate
 * @property {number}  SRS                  Starting Rate for Savings band (£5,000)
 * @property {number}  PSA_basic            Personal Savings Allowance — basic rate taxpayer
 * @property {number}  PSA_higher           Personal Savings Allowance — higher rate taxpayer
 * @property {number}  dividendAllowance
 * @property {number}  cgtExempt            Annual CGT exempt amount
 * @property {number}  cgtBasicRate         CGT rate for basic rate taxpayers (investments)
 * @property {number}  cgtHigherRate        CGT rate for higher/additional rate taxpayers
 * @property {number}  isaAllowance         Per-person annual ISA subscription limit
 */

/** @type {TaxBands} */
export const TAX_2026_27 = Object.freeze({
  year:                '2026/27',
  PA:                  12_570,
  taperStart:         100_000,
  basicLimit:          50_270,
  additionalThreshold: 125_140,
  basicRate:           0.20,
  higherRate:          0.40,
  additionalRate:      0.45,
  SRS:                  5_000,
  PSA_basic:            1_000,
  PSA_higher:             500,
  dividendAllowance:      500,
  cgtExempt:            3_000,
  cgtBasicRate:          0.18,
  cgtHigherRate:         0.24,
  isaAllowance:        20_000,
});

/** The active tax bands used by the UI. Swap this reference each April. */
export const TAX_CURRENT = TAX_2026_27;

// ---------------------------------------------------------------------------
// Wrapper names
// ---------------------------------------------------------------------------

/** All recognised wrapper types. */
export const WRAPPERS = /** @type {const} */ (['ISA', 'SIPP', 'GIA', 'Cash', 'QMMF']);

/** Wrappers that are fixed-cash (no equity allocation). */
export const FIXED_CASH_WRAPPERS = new Set(['Cash', 'QMMF']);

/** Allocation class names matching account.alloc keys. */
export const ALLOC_CLASSES = /** @type {const} */ (['equities', 'bonds', 'cashlike', 'cash']);

// ---------------------------------------------------------------------------
// Preload — default values for sidebar inputs
// ---------------------------------------------------------------------------

/** @type {import('./inputs.js').ProjectionInputs} */
export const PRELOAD_INPUTS = Object.freeze({
  woodyDOB:             1968,
  heidiDOB:             1967,
  startYear:            2026,
  endYear:              2060,
  spending:            45_000,
  heidiSalary:         15_000,
  heidiSalaryStopAge:      63,
  woodySPAge:              67,
  woodySPAmt:          12_000,
  heidiSPAge:              67,
  heidiSPAmt:          12_547,
  woodyBal: {
    Cash:  70_000,
    QMMF: 450_000,
    GIA:  150_000,
    SIPP: 450_000,
    ISA:  250_000,
  },
  heidiBal: {
    Cash:       0,
    GIA:    5_000,
    SIPP: 200_000,
    ISA:  150_000,
  },
  woodyGIACostBasis: 100_000,
  heidiGIACostBasis:   4_000,
  qmmfAnnualRate:        3.8,
  qmmfMonthlyDraw:     1_333,
  growthRate:            0.06,
  inflationRate:         0.025,
  withdrawalOrder: {
    woody: ['GIA', 'SIPP', 'ISA'],
    heidi: ['GIA', 'SIPP', 'ISA'],
  },
  bedAndISA: {
    enabled:   false,
    woodyGIA:  20_000,
    woodyQMMF: 20_000,
    heidiGIA:   5_000,
  },
  stepDownPct:    0,    // % reduction at age 75; 0 = disabled
  thresholdMode:  'frozen',  // 'frozen' | 'fromYear' | 'always'
  thresholdFromYear: 2028,
});

// ---------------------------------------------------------------------------
// Preload accounts (for setup page)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} AccountPreload
 * @property {string} name
 * @property {string} wrapper
 * @property {string} owner
 * @property {number} value
 * @property {number|null} costBasis   GIA only
 * @property {number|null} rate        QMMF only
 * @property {{ equities:number, bonds:number, cashlike:number, cash:number }} alloc
 */

/** @type {AccountPreload[]} */
export const PRELOAD_ACCOUNTS = Object.freeze([
  { name: 'SIPP',         wrapper: 'SIPP', owner: 'Woody', value: 450_000, costBasis: null, rate: null, alloc: { equities: 65, bonds: 35, cashlike: 0, cash: 0 } },
  { name: 'SIPP',         wrapper: 'SIPP', owner: 'Heidi', value: 200_000, costBasis: null, rate: null, alloc: { equities: 65, bonds: 35, cashlike: 0, cash: 0 } },
  { name: 'Vanguard ISA', wrapper: 'ISA',  owner: 'Woody', value: 250_000, costBasis: null, rate: null, alloc: { equities: 100, bonds: 0, cashlike: 0, cash: 0 } },
  { name: 'Vanguard ISA', wrapper: 'ISA',  owner: 'Heidi', value: 150_000, costBasis: null, rate: null, alloc: { equities: 100, bonds: 0, cashlike: 0, cash: 0 } },
  { name: 'GIA',          wrapper: 'GIA',  owner: 'Woody', value: 150_000, costBasis: 100_000, rate: null, alloc: { equities: 100, bonds: 0, cashlike: 0, cash: 0 } },
  { name: 'GIA',          wrapper: 'GIA',  owner: 'Heidi', value:   5_000, costBasis:   4_000, rate: null, alloc: { equities: 100, bonds: 0, cashlike: 0, cash: 0 } },
  { name: 'QMMF (T212)',  wrapper: 'QMMF', owner: 'Woody', value: 450_000, costBasis: null, rate: 3.8,  alloc: { equities: 0, bonds: 0, cashlike: 0, cash: 100 } },
  { name: 'Cash',         wrapper: 'Cash', owner: 'Woody', value:  70_000, costBasis: null, rate: null, alloc: { equities: 0, bonds: 0, cashlike: 0, cash: 100 } },
]);
