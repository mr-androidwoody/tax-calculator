/**
 * inputs.js
 *
 * ProjectionInputs typedef and PRELOAD_INPUTS passthrough.
 * No DOM access — safe for Web Worker and Node test contexts.
 *
 * DOM-reading (readInputs) and validation (validateInputs) are deferred to
 * a later phase once the UI layer is built.
 */

'use strict';

import { TAX_2026_27, PRELOAD_INPUTS } from './constants.js';

// ---------------------------------------------------------------------------
// Typedef
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ProjectionInputs
 * @property {number}   woodyDOB              Birth year (e.g. 1968)
 * @property {number}   heidiDOB              Birth year (e.g. 1967)
 * @property {number}   startYear             First projection year (e.g. 2026)
 * @property {number}   endYear               Last projection year (e.g. 2060)
 * @property {number}   spending              Annual household spending target (£, real base-year)
 * @property {number}   heidiSalary           Gross annual salary (£, real base-year)
 * @property {number}   heidiSalaryStopAge    Age at which Heidi stops working
 * @property {number}   woodySPAge            Age Woody's State Pension starts
 * @property {number}   woodySPAmt            Annual State Pension (£, real base-year)
 * @property {number}   heidiSPAge            Age Heidi's State Pension starts
 * @property {number}   heidiSPAmt            Annual State Pension (£, real base-year)
 * @property {{ Cash:number, QMMF:number, GIA:number, SIPP:number, ISA:number }} woodyBal
 * @property {{ Cash:number, GIA:number, SIPP:number, ISA:number }}              heidiBal
 * @property {number}   woodyGIACostBasis     Cost basis for Woody's GIA (£); 0 → use balance
 * @property {number}   heidiGIACostBasis     Cost basis for Heidi's GIA (£); 0 → use balance
 * @property {number}   qmmfAnnualRate        QMMF nominal annual rate (%, e.g. 3.8)
 * @property {number}   qmmfMonthlyDraw       Fixed monthly draw from QMMF (£)
 * @property {number}   growthRate            Portfolio growth rate (decimal, e.g. 0.06)
 * @property {number}   inflationRate         Inflation rate (decimal, e.g. 0.025)
 * @property {{ woody: string[], heidi: string[] }} withdrawalOrder
 *   Wrapper names in draw order; Cash and QMMF are pre-handled and filtered out
 * @property {{ enabled:boolean, woodyGIA:number, woodyQMMF:number, heidiGIA:number }} bedAndISA
 * @property {number}   stepDownPct           Spending reduction % at age 75 (0 = disabled)
 * @property {'frozen'|'fromYear'|'always'} thresholdMode
 * @property {number}   thresholdFromYear     Year uprating begins (used when mode = 'fromYear')
 * @property {import('./constants.js').TaxBands} taxBands  Tax year configuration
 */

// ---------------------------------------------------------------------------
// Default inputs factory
// ---------------------------------------------------------------------------

/**
 * Return a fully-resolved ProjectionInputs object from the preload defaults.
 * Merges PRELOAD_INPUTS with the current tax bands and converts percentage
 * inputs (growth, inflation) to decimal form.
 *
 * This is the canonical inputs source for tests and golden scenarios.
 * The UI layer will produce an equivalent object via readInputs() (future).
 *
 * @returns {ProjectionInputs}
 */
export function defaultInputs() {
  const p = PRELOAD_INPUTS;
  return {
    woodyDOB:            p.woodyDOB,
    heidiDOB:            p.heidiDOB,
    startYear:           p.startYear,
    endYear:             p.endYear,
    spending:            p.spending,
    heidiSalary:         p.heidiSalary,
    heidiSalaryStopAge:  p.heidiSalaryStopAge,
    woodySPAge:          p.woodySPAge,
    woodySPAmt:          p.woodySPAmt,
    heidiSPAge:          p.heidiSPAge,
    heidiSPAmt:          p.heidiSPAmt,
    woodyBal: { ...p.woodyBal },
    heidiBal: { ...p.heidiBal },
    woodyGIACostBasis:   p.woodyGIACostBasis,
    heidiGIACostBasis:   p.heidiGIACostBasis,
    qmmfAnnualRate:      p.qmmfAnnualRate,
    qmmfMonthlyDraw:     p.qmmfMonthlyDraw,
    growthRate:          p.growthRate,    // already stored as decimal in PRELOAD_INPUTS
    inflationRate:       p.inflationRate, // already stored as decimal in PRELOAD_INPUTS
    withdrawalOrder:     {
      woody: [...p.withdrawalOrder.woody],
      heidi: [...p.withdrawalOrder.heidi],
    },
    bedAndISA: { ...p.bedAndISA },
    stepDownPct:         p.stepDownPct,
    thresholdMode:       p.thresholdMode,
    thresholdFromYear:   p.thresholdFromYear,
    taxBands:            TAX_2026_27,
  };
}
