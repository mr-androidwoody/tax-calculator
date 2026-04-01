// tax/household-tax.js

import TAX_POLICY_2026_27 from './policy.js';
import { calculateAnnualTax } from './annual-tax.js';

/**
 * Calculate tax across all people in a household.
 *
 * Input shape:
 * {
 *   people: [
 *     {
 *       id: 'p1',
 *       name: 'Person 1',
 *       income: {
 *         statePension?: number,
 *         dbPension?: number,
 *         pensionDrawdown?: number,
 *         employment?: number,
 *         selfEmployment?: number,
 *         otherTaxable?: number,
 *         qmmfInterest?: number,
 *         cashInterest?: number,
 *         otherSavings?: number,
 *         dividends?: number,
 *         taxableGains?: number
 *       }
 *     }
 *   ]
 * }
 *
 * Ownership rule is strict:
 * - each person is taxed independently
 * - no cross-person allocation
 *
 * @param {object} household
 * @param {object} [policy=TAX_POLICY_2026_27]
 * @returns {object}
 */
export function calculateHouseholdTax(household = {}, policy = TAX_POLICY_2026_27) {
  const people = Array.isArray(household?.people) ? household.people : [];

  const peopleResults = people.map((person) => {
    const annualTax = calculateAnnualTax(person?.income || {}, policy);

    return {
      id: String(person?.id || ''),
      name: String(person?.name || ''),
      tax: annualTax
    };
  });

  const totals = peopleResults.reduce(
    (acc, person) => {
      const tax = person.tax;

      acc.grossCashIncome += tax.netIncomeAfterTax.grossCashIncome;
      acc.netAfterIncomeTax += tax.netIncomeAfterTax.afterIncomeTax;
      acc.netAfterAllTax += tax.netIncomeAfterTax.afterAllTax;

      acc.incomeTax += tax.taxTotals.incomeTax;
      acc.capitalGainsTax += tax.taxTotals.capitalGainsTax;
      acc.totalTax += tax.taxTotals.totalTax;

      acc.higherRatePeople += tax.bandSummary.hasHigherRateIncome ? 1 : 0;
      acc.additionalRatePeople += tax.bandSummary.hasAdditionalRateIncome ? 1 : 0;

      return acc;
    },
    {
      grossCashIncome: 0,
      netAfterIncomeTax: 0,
      netAfterAllTax: 0,
      incomeTax: 0,
      capitalGainsTax: 0,
      totalTax: 0,
      higherRatePeople: 0,
      additionalRatePeople: 0
    }
  );

  return {
    policy: {
      taxYear: policy.taxYear,
      region: policy.region
    },

    people: peopleResults,

    household: {
      grossCashIncome: totals.grossCashIncome,
      netAfterIncomeTax: totals.netAfterIncomeTax,
      netAfterAllTax: totals.netAfterAllTax,

      taxPaid: {
        incomeTax: totals.incomeTax,
        capitalGainsTax: totals.capitalGainsTax,
        totalTax: totals.totalTax
      },

      bandSummary: {
        peopleWithHigherRateIncome: totals.higherRatePeople,
        peopleWithAdditionalRateIncome: totals.additionalRatePeople,
        anyHigherRate: totals.higherRatePeople > 0,
        anyAdditionalRate: totals.additionalRatePeople > 0
      }
    }
  };
}

/**
 * Convenience helper for the planner where people are already split out.
 *
 * @param {Array<object>} people
 * @param {object} [policy=TAX_POLICY_2026_27]
 * @returns {object}
 */
export function calculateHouseholdTaxFromPeople(people = [], policy = TAX_POLICY_2026_27) {
  return calculateHouseholdTax({ people }, policy);
}

export default {
  calculateHouseholdTax,
  calculateHouseholdTaxFromPeople
};