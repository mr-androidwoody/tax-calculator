export function getHouseholdInput() {
  return {
    people: [
      buildPersonInput('woody', 'Woody'),
      buildPersonInput('heidi', 'Heidi')
    ]
  };
}

function buildPersonInput(prefix, name) {
  return {
    id: prefix,
    name,
    income: {
      statePension: getAmount(`${prefix}StatePension`),
      dbPension: getAmount(`${prefix}DbPension`),
      pensionDrawdown: getAmount(`${prefix}PensionDrawdown`),
      employment: getAmount(`${prefix}Employment`),
      selfEmployment: getAmount(`${prefix}SelfEmployment`),
      otherTaxable: getAmount(`${prefix}OtherTaxable`),
      qmmfInterest: getAmount(`${prefix}QmmfInterest`),
      cashInterest: getAmount(`${prefix}CashInterest`),
      otherSavings: getAmount(`${prefix}OtherSavings`),
      dividends: getAmount(`${prefix}Dividends`),
      taxableGains: getAmount(`${prefix}TaxableGains`)
    },
    targets: {
      netIncomeTarget: getAmount(`${prefix}NetIncomeTarget`)
    },
    assets: {
      cash: getAmount(`${prefix}AssetCash`),
      gia: getAmount(`${prefix}AssetGia`),
      isa: getAmount(`${prefix}AssetIsa`),
      pension: getAmount(`${prefix}AssetPension`)
    }
  };
}

function getAmount(id) {
  const el = document.getElementById(id);
  const raw = Number(el?.value);
  return Number.isFinite(raw) ? Math.max(0, raw) : 0;
}
