export function getHouseholdInput() {
  return {
    people: [
      {
        id: 'woody',
        name: 'Woody',
        income: {
          statePension: get('woodyStatePension'),
          dbPension: get('woodyDbPension'),
          pensionDrawdown: get('woodyPensionDrawdown'),
          employment: get('woodyEmployment'),
          selfEmployment: get('woodySelfEmployment'),
          otherTaxable: get('woodyOtherTaxable'),
          qmmfInterest: get('woodyQmmfInterest'),
          cashInterest: get('woodyCashInterest'),
          otherSavings: get('woodyOtherSavings'),
          dividends: get('woodyDividends'),
          taxableGains: get('woodyTaxableGains')
        }
      },
      {
        id: 'heidi',
        name: 'Heidi',
        income: {
          statePension: get('heidiStatePension'),
          dbPension: get('heidiDbPension'),
          pensionDrawdown: get('heidiPensionDrawdown'),
          employment: get('heidiEmployment'),
          selfEmployment: get('heidiSelfEmployment'),
          otherTaxable: get('heidiOtherTaxable'),
          qmmfInterest: get('heidiQmmfInterest'),
          cashInterest: get('heidiCashInterest'),
          otherSavings: get('heidiOtherSavings'),
          dividends: get('heidiDividends'),
          taxableGains: get('heidiTaxableGains')
        }
      }
    ]
  };
}

function get(id) {
  const el = document.getElementById(id);
  const value = Number(el?.value);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}