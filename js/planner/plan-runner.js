import { calculateAnnualTax } from '../../tax/annual-tax.js';
import { calculateHouseholdTax } from '../../tax/household-tax.js';

export function runPlanner(householdInput) {
  const people = Array.isArray(householdInput?.people) ? householdInput.people : [];

  const peopleResults = people.map((person) => {
    const income = person?.income || {};
    const tax = calculateAnnualTax(income);

    return {
      id: String(person?.id || ''),
      name: String(person?.name || ''),
      income,
      tax
    };
  });

  const householdResult = calculateHouseholdTax({ people });

  return {
    peopleResults,
    householdResult
  };
}