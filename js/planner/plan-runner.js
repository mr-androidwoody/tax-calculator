import { calculateAnnualTax } from '../../tax/annual-tax.js';
import { calculateHouseholdTax } from '../../tax/household-tax.js';

export function runPlanner(householdInput) {
  const peopleResults = householdInput.people.map((person) => {
    const tax = calculateAnnualTax(person.income);
    return {
      ...person,
      tax
    };
  });

  const householdResult = calculateHouseholdTax(householdInput);

  return {
    peopleResults,
    householdResult
  };
}