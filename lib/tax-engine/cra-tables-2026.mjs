/**
 * CRA-correct 2026 tables — the wrapper's source of truth.
 *
 * Sourced from data/tax-tables/2026.cra.json (snapshot Sept 3, 2026 vs Tier-1 officials).
 * Includes the two overrides where @equisoft/tax-ca@2026.10.0 is stale:
 *   BC RATES[0] 0.0506 -> 0.0560 (+ credit rate), PE 20%-over-$200k bracket added.
 * MB uses frozen/T4032 values ($47,000/$100,000) — see snapshot for the conflict note.
 *
 * BPA values: federal Tier-1 confirmed; provincials library+Tier-2 pending Form 428.
 */
import snapshot from '../../data/tax-tables/2026.cra.json' with { type: 'json' };

function toRates(pairs) {
  let from = 0;
  return pairs.map(([to, rate]) => {
    const r = { FROM: from, TO: to === null ? 999999999 : to, RATE: rate };
    from = to;
    return r;
  });
}

const CREDIT_RATES = {
  // Credit rate = first-bracket rate (verified: library computes baseCredit as
  // BPA × RATES[0]; YT's TAX_CREDIT_RATE field reads 0.14 but the engine uses 0.064).
  // BC 0.056 is the OVERRIDE (library stale 0.0506) — BC 2026 Budget + CRA page.
  CA: 0.14,
  AB: 0.08,
  BC: 0.056,
  MB: 0.108,
  NB: 0.094,
  NL: 0.087,
  NS: 0.0879,
  PE: 0.095,
  ON: 0.0505,
  QC: 0.14,
  SK: 0.105,
  NT: 0.059,
  NU: 0.04,
  YT: 0.064,
};

// Ontario two-tier surtax on (base − credit), verified Sept 3 2026 vs
// Wealthsimple + catax.tools + financialtools (ON428 structure).
// Library output $6,377.83 at $100k matches catax.tools $6,378 independently.
export const ON_SURTAX = [
  { FROM: 0, TO: 5818, RATE: 0 },
  { FROM: 5818, TO: 7446, RATE: 0.2 },
  { FROM: 7446, TO: 999999999, RATE: 0.56 },
];

function bpaFor(code) {
  if (code === 'CA') return snapshot.federal.bpa;
  return snapshot.provinces[code].bpa;
}

export const FEDERAL = {
  RATES: toRates(snapshot.federal.brackets.map((b) => [b.to, b.rate])),
  BPA: snapshot.federal.bpa,
  CREDIT_RATE: CREDIT_RATES.CA,
};

export const PROVINCES = {};
for (const [code, prov] of Object.entries(snapshot.provinces)) {
  PROVINCES[code] = {
    RATES: toRates(prov.brackets),
    BPA: prov.bpa,
    CREDIT_RATE: CREDIT_RATES[code],
    STATUS: prov.status,
  };
}

export const QC_ABATEMENT = snapshot.provinces.QC.abatement ?? 0.165;
export const SNAPSHOT_META = snapshot._meta;
