export function renderResults({ peopleResults, householdResult }) {
  renderHousehold(householdResult);
  renderPerson('woody', peopleResults[0]);
  renderPerson('heidi', peopleResults[1]);
  renderRaw({ peopleResults, householdResult });
}