// js/planner/plan-runner.js
//
// Integration boundary between the planner engine and the tax engine.
//
// Responsibility:
//   - Receive raw form input (which now includes targets + assets)
//   - Call annual-planner.js to generate taxable flows
//   - Call calculateHouseholdTax with those flows
//   - Finalise planner person results with actual (not estimated) net figures
//   - Return a combined result for the UI
//
// This is the only file that calls both the planner and the tax engine.
// Neither side should call the other directly.

import { buildAnnualPlan } from './annual-planner.js';
import { calculateHouseholdTax } from '../../tax/household-tax.js';

/**
 * Runs the full planner → tax pipeline for one scenario.
 *
 * @param {object} formInput
 * @param {Array<{
 *   id: string,
 *   name: string,
 *   income: object,
 *   targets: { netIncomeTarget: number },
 *   assets: { cash: number, gia: number, isa: number, pension: number }
 * }>} formInput.people
 *
 * @returns {{
 *   planner: { people: Array<object> },
 *   tax: { peopleResults: Array<object>, householdResult: object }
 * }}
 */
export function runPlanner(formInput) {
  // Step 1: generate planned income flows and planner metadata.
  const annualPlan = buildAnnualPlan(formInput);

  // Step 2: run the tax engine on the planned income flows.
  // The taxInput shape is exactly what calculateHouseholdTax expects.
  const householdTaxResult = calculateHouseholdTax({
    people: annualPlan.taxInput.people
  });

  // Step 3: finalise planner results using actual tax-engine output.
  // The planner's achievedNetIncome estimate may differ slightly from the tax
  // engine's answer because bisection ran calculateAnnualTaxCompact per-person
  // in isolation. Replace estimates with actuals from the authoritative call.
  const finalisedPlannerPeople = annualPlan.planner.people.map((plannerPerson, i) => {
    const taxPerson = householdTaxResult?.people?.[i];
    const actualNet = taxPerson?.summary?.netAfterAllTax ?? plannerPerson.achievedNetIncome;

    return {
      ...plannerPerson,
      achievedNetIncome: actualNet,
      shortfall: Math.max(0, plannerPerson.targetNetIncome - actualNet)
    };
  });

  // Step 4: assemble the combined result for the UI.
  // The tax section mirrors the shape the existing results.js already expects
  // so the tax display continues to work without modification.
  return {
    planner: {
      people: finalisedPlannerPeople
    },
    tax: {
      peopleResults: householdTaxResult.people.map((p) => ({
        id: p.id,
        name: p.name,
        income: annualPlan.taxInput.people.find((tp) => tp.id === p.id)?.income || {},
        tax: p.tax
      })),
      householdResult: householdTaxResult
    }
  };
}