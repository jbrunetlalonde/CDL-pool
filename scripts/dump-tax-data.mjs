/**
 * Dump what @equisoft/tax-ca@2026.10.0 ACTUALLY ships.
 *
 * Purpose: answer "what data do we have?" before trusting it.
 * This script does NOT verify correctness — it just prints actuals
 * so you can compare them to CRA sources (see docs/data-sources.md).
 *
 * Run (after `npm i @equisoft/tax-ca@~2026.10.0`):
 *   node scripts/dump-tax-data.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  TAX_BRACKETS,
  CPP,
  QPP,
  EI,
  QPIP,
  RRSP,
  TFSA,
  RESP,
  CanadaEducationSavingsGrant,
  PROVINCIAL_CODES,
  FEDERAL_CODE,
} = require('@equisoft/tax-ca');

const provinces = Object.values(PROVINCIAL_CODES); // 13 codes

console.log(`FEDERAL_CODE=${FEDERAL_CODE}`);
console.log(`Provinces (${provinces.length}): ${provinces.join(' ')}`);
console.log(`TAX_BRACKETS keys: ${Object.keys(TAX_BRACKETS).join(' ')}`);
console.log('');

for (const code of [FEDERAL_CODE, ...provinces]) {
  const b = TAX_BRACKETS[code];
  if (!b) {
    console.log(`${code}: MISSING — no entry in TAX_BRACKETS`);
    continue;
  }
  console.log(
    `${code} BPA=${JSON.stringify(b.BASIC_PERSONAL_AMOUNT)} CREDIT_RATE=${b.TAX_CREDIT_RATE} RATES=${JSON.stringify(b.RATES)}`
  );
}

console.log('');
console.log(`CPP YMPE=${CPP.PENSIONABLE_EARNINGS.YMPE} YAMPE=${CPP.PENSIONABLE_EARNINGS.YAMPE} EXEMPT=${CPP.PENSIONABLE_EARNINGS.BASIC_EXEMPTION} BASE=${CPP.CONTRIBUTION_RATES.BASE} STEP2=${CPP.CONTRIBUTION_RATES.ENHANCEMENT_STEP_2}`);
console.log(`QPP YMPE=${QPP.PENSIONABLE_EARNINGS.YMPE} YAMPE=${QPP.PENSIONABLE_EARNINGS.YAMPE} EXEMPT=${QPP.PENSIONABLE_EARNINGS.BASIC_EXEMPTION} BASE=${QPP.CONTRIBUTION_RATES.BASE} STEP2=${QPP.CONTRIBUTION_RATES.ENHANCEMENT_STEP_2}`);
console.log(`EI MIE=${EI.MAX_INSURABLE_EARNINGS} CA=${EI.PREMIUM_RATES.CA} QC=${EI.PREMIUM_RATES.QC}`);
console.log(`QPIP MIE=${QPIP.MAX_INSURABLE_EARNINGS} SALARIED=${QPIP.PREMIUM_RATES.SALARIED} SELF=${QPIP.PREMIUM_RATES.SELF_EMPLOYED}`);
console.log(`RRSP MAX=${RRSP.MAX_CONTRIBUTION} TFSA MAX=${TFSA.MAX_CONTRIBUTION} (updated ${TFSA.UPDATE_YEAR}) RESP MAX=${RESP.MAX_CONTRIBUTION} CESG=${CanadaEducationSavingsGrant.YEARLY_GRANT_PERCENT} max=${CanadaEducationSavingsGrant.MAX_GRANT}`);
