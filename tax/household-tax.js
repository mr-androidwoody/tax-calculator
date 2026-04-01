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

    const grossCashIncome = Number(annualTax?.netIncomeAfterTax?.grossCashIncome) || 0;
    const netAfterIncomeTax = Number(annualTax?.netIncomeAfterTax?.afterIncomeTax) || 0;
    const netAfterAllTax = Number(annualTax?.netIncomeAfterTax?.afterAllTax) || 0;

    const incomeTax = Number(annualTax?.taxTotals?.incomeTax) || 0;
    const capitalGainsTax = Number(annualTax?.taxTotals?.capitalGainsTax) || 0;
    const totalTax = Number(annualTax?.taxTotals?.totalTax) || 0;

    const hasHigherRateIncome = Boolean(annualTax?.bandSummary?.hasHigherRateIncome);
    const hasAdditionalRateIncome = Boolean(annualTax?.bandSummary?.hasAdditionalRateIncome);

    return {
      id: String(person?.id || ''),
      name: String(person?.name || ''),
      tax: annualTax,
      summary: {
        grossCashIncome,
        netAfterIncomeTax,
        netAfterAllTax,
        incomeTax,
        capitalGainsTax,
        totalTax,
        hasHigherRateIncome,
        hasAdditionalRateIncome
      }
    };
  });

  const totals = peopleResults.reduce(
    (acc, person) => {
      const summary = person.summary || {};

      acc.grossCashIncome += Number(summary.grossCashIncome) || 0;
      acc.netAfterIncomeTax += Number(summary.netAfterIncomeTax) || 0;
      acc.netAfterAllTax += Number(summary.netAfterAllTax) || 0;

      acc.incomeTax += Number(summary.incomeTax) || 0;
      acc.capitalGainsTax += Number(summary.capitalGainsTax) || 0;
      acc.totalTax += Number(summary.totalTax) || 0;

      acc.higherRatePeople += summary.hasHigherRateIncome ? 1 : 0;
      acc.additionalRatePeople += summary.hasAdditionalRateIncome ? 1 : 0;

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