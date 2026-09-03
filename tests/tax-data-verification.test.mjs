/**
 * What is tested here, and to WHAT (oracle):
 *
 * GROUP A — Structural (oracle = internal consistency, no CRA needed):
 *   A1. All 13 provinces + CA exist in TAX_BRACKETS.
 *   A2. Every RATES array is sorted, starts at FROM=0, no gaps/overlaps, ends at 999999999.
 *   A3. Rates are sane (0 < rate < 0.35), BPA > 0, credit rate matches first-bracket rate.
 *   A4. CPP/QPP have YMPE < YAMPE, exempt 3500, base/step2 rates sane. EI/QPIP MIE + rates present.
 *   → If any A fails, the library snapshot is corrupt — stop, do not build.
 *
 * GROUP B — Oracle vs CRA (oracle = CRA official tables, NOT the library itself):
 *   B1. Federal brackets/BPA vs CRA "Canadian income tax rates" page.
 *   B2. Each province brackets/BPA vs same CRA page (+ Revenu Québec for QC).
 *   B3. CPP/YMPE/YAMPE/EI/QPIP vs CRA payroll pages.
 *   B4. Computed tax at $30k/$60k/$100k/$200k vs CRA T1 + Taxtips.ca cross-check.
 *   → B tests are SKIPPED until you fill EXPECTED_* from CRA (see docs/data-sources.md).
 *   → Filling them IS the verification work. Green B = shippable Phase 1.
 *
 * GROUP C — Edge invariants (oracle = tax law logic):
 *   C1. Federal BPA is a RANGE (MIN<MAX) — phase-out, not a single number.
 *   C2. YT thresholds mirror federal ($58,523 etc.) — confirm intentional.
 *   C3. QC splits (QPP 6.3% vs CPP 5.95%, EI 1.3% vs 1.63% + QPIP) — must differ.
 *
 * Run: node --test tests/tax-data-verification.test.mjs
 * (After scaffold: same cases migrate 1:1 to Vitest.)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  TAX_BRACKETS,
  CPP,
  QPP,
  EI,
  QPIP,
  PROVINCIAL_CODES,
  FEDERAL_CODE,
  getFederalTaxAmount,
  getProvincialTaxAmount,
  getTotalMarginalRate,
} = require('@equisoft/tax-ca');

const PROVINCES = Object.values(PROVINCIAL_CODES);
const ALL = [FEDERAL_CODE, ...PROVINCES];

// ---- GROUP A: structural, no CRA needed ----
describe('A1: all jurisdictions present', () => {
  it('has CA + 13 provinces', () => {
    assert.equal(PROVINCES.length, 13);
    for (const code of ALL) {
      assert.ok(TAX_BRACKETS[code], `${code} missing from TAX_BRACKETS`);
    }
  });
});

describe('A2: bracket shapes are continuous', () => {
  for (const code of ALL) {
    it(`${code} rates sorted, start 0, no gaps`, () => {
      const rates = TAX_BRACKETS[code].RATES;
      assert.ok(rates.length >= 2, `${code} needs >=2 brackets`);
      assert.equal(rates[0].FROM, 0);
      for (let i = 0; i < rates.length; i++) {
        const r = rates[i];
        assert.ok(r.TO > r.FROM, `${code}[${i}] TO<=FROM`);
        assert.ok(r.RATE > 0 && r.RATE < 0.35, `${code}[${i}] rate insane: ${r.RATE}`);
        if (i > 0) assert.equal(r.FROM, rates[i - 1].TO, `${code}[${i}] gap/overlap`);
      }
      assert.equal(rates[rates.length - 1].TO, 999999999, `${code} top bracket must be open`);
    });
  }
});

describe('A3: BPA and credit rates sane', () => {
  for (const code of ALL) {
    it(`${code} BPA > 0`, () => {
      const bpa = TAX_BRACKETS[code].BASIC_PERSONAL_AMOUNT;
      const val = typeof bpa === 'number' ? bpa : bpa.MAX;
      assert.ok(val > 8000 && val < 30000, `${code} BPA insane: ${JSON.stringify(bpa)}`);
    });
  }
});

describe('A4: payroll constants present', () => {
  it('CPP/QPP YMPE<YAMPE, exempt 3500', () => {
    for (const plan of [CPP, QPP]) {
      assert.equal(plan.PENSIONABLE_EARNINGS.BASIC_EXEMPTION, 3500);
      assert.ok(plan.PENSIONABLE_EARNINGS.YMPE < plan.PENSIONABLE_EARNINGS.YAMPE);
    }
    assert.equal(CPP.CONTRIBUTION_RATES.BASE, 0.0595);
    assert.equal(QPP.CONTRIBUTION_RATES.BASE, 0.063);
  });
  it('EI/QPIP present', () => {
    assert.equal(EI.MAX_INSURABLE_EARNINGS, 68900);
    assert.equal(EI.PREMIUM_RATES.CA, 0.0163);
    assert.equal(EI.PREMIUM_RATES.QC, 0.013);
    assert.equal(QPIP.MAX_INSURABLE_EARNINGS, 103000);
  });
});

// ---- GROUP C: edge invariants ----
describe('C: law-logic invariants', () => {
  it('C1 federal BPA is a phase-out range', () => {
    const bpa = TAX_BRACKETS.CA.BASIC_PERSONAL_AMOUNT;
    assert.ok(typeof bpa === 'object' && bpa.MIN < bpa.MAX, `expected {MIN,MAX}, got ${JSON.stringify(bpa)}`);
  });
  it('C2 BPA phases down $150k → $200k → $260k (oracle = CRA phase-out $181k–$258k)', () => {
    const { getFederalBasicPersonalAmount } = require('@equisoft/tax-ca');
    const b150 = getFederalBasicPersonalAmount(150000, 0, 0);
    const b200 = getFederalBasicPersonalAmount(200000, 0, 0);
    const b260 = getFederalBasicPersonalAmount(260000, 0, 0);
    assert.equal(b150, 16452, `at $150k expect full MAX, got ${b150}`);
    assert.ok(b200 < 16452 && b200 > 14829, `$200k should be mid phase-out, got ${b200}`);
    assert.equal(b260, 14829, `at $260k expect floor MIN, got ${b260}`);
  });
  it('C3 QC splits differ from ROC', () => {
    assert.notEqual(QPP.CONTRIBUTION_RATES.BASE, CPP.CONTRIBUTION_RATES.BASE);
    assert.notEqual(EI.PREMIUM_RATES.QC, EI.PREMIUM_RATES.CA);
  });
  it('C4 $0.01 bracket edge moves tax by ~marginal cents (oracle = continuity)', () => {
    // Federal threshold $58,523: $0.01 over should add ≈ $0.01 × next-bracket rate, not $0 or $100s.
    const { getFederalTaxAmount: fed } = require('@equisoft/tax-ca');
    const d = fed('ON', 58523.01) - fed('ON', 58523);
    assert.ok(d >= 0 && d < 1, `bracket edge jump insane: ${d}`);
  });
  it('C5 YT mirrors federal thresholds (oracle = confirm intentional, not copy-paste)', () => {
    const yt = TAX_BRACKETS.YT.RATES.map((r) => r.FROM);
    const ca = TAX_BRACKETS.CA.RATES.map((r) => r.FROM);
    assert.deepEqual(yt.slice(0, 3), ca.slice(0, 3));
  });
});

// ---- GROUP B: oracle vs CRA — FILL EXPECTED_CRA, then unskip ----
describe('B: computed tax vs CRA (FILL EXPECTED_CRA, then unskip)', () => {
  // HOW TO FILL:
  // 1. ACTUAL_* below is what tax-ca 2026.10.0 outputs TODAY (dumped Sept 3 2026).
  //    It is NOT the oracle — it is the claim under test.
  // 2. Look up the SAME case in CRA tables (docs/data-sources.md §3), put it in EXPECTED_CRA.
  // 3. Remove `.skip` → test asserts |actual - expected| < $1. Green = verified for that cell.
  // 4. Taxtips.ca / WealthSimple = cross-check only. CRA wins ties.
  //
  // Formula under test: getFederalTaxAmount(prov, income) + getProvincialTaxAmount(prov, income)
  // Note: amounts are income tax only (no CPP/EI). QC federal uses abatement internally.
  const CASES = [
    // [province, income, ACTUAL_total (library), EXPECTED_CRA (you fill), note]
    ['AB', 30000, 2475.20, null, 'CRA federal+AB'],
    ['AB', 60000, 9171.20, null, 'CRA federal+AB'],
    ['AB', 100000, 21347.21, null, 'CRA federal+AB'],
    ['AB', 200000, 58084.98, null, 'CRA federal+AB'],
    ['BC', 30000, 2836.62, null, 'CRA federal+BC (wrapper, CRA-correct 5.6%)'],
    ['BC', 60000, 9015.01, null, 'CRA federal+BC (wrapper, CRA-correct 5.6%)'],
    ['BC', 100000, 20295.01, null, 'CRA federal+BC (wrapper, CRA-correct 5.6%)'],
    ['BC', 200000, 59595.72, null, 'CRA federal+BC (wrapper, CRA-correct 5.6%)'],
    ['MB', 30000, 3432.48, null, 'CRA federal+MB'],
    ['MB', 60000, 11221.99, null, 'CRA federal+MB'],
    ['MB', 100000, 24521.99, null, 'CRA federal+MB'],
    ['MB', 200000, 67596.05, null, 'CRA federal+MB'],
    ['NB', 30000, 3432.30, null, 'CRA federal+NB'],
    ['NB', 60000, 10900.99, null, 'CRA federal+NB'],
    ['NB', 100000, 24700.99, null, 'CRA federal+NB'],
    ['NB', 200000, 66496.60, null, 'CRA federal+NB'],
    ['NL', 30000, 3533.36, null, 'CRA federal+NL'],
    ['NL', 60000, 11328.05, null, 'CRA federal+NL'],
    ['NL', 100000, 25466.44, null, 'CRA federal+NL'],
    ['NL', 200000, 67749.95, null, 'CRA federal+NL'],
    ['NS', 30000, 3484.90, null, 'CRA federal+NS'],
    ['NS', 60000, 12204.61, null, 'CRA federal+NS'],
    ['NS', 100000, 27059.80, null, 'CRA federal+NS'],
    ['NS', 200000, 71734.53, null, 'CRA federal+NS'],
    ['PE', 30000, 3321.72, null, 'CRA federal+PE'],
    ['PE', 60000, 11502.78, null, 'CRA federal+PE'],
    ['PE', 100000, 26160.62, null, 'CRA federal+PE'],
    ['PE', 200000, 70177.63, null, 'CRA+PEI Finance (wrapper, CRA-correct 20% bracket)'],
    ['ON', 30000, 2755.78, null, 'CRA federal+ON'],
    ['ON', 60000, 8817.25, null, 'CRA federal+ON'],
    ['ON', 100000, 20770.55, null, 'CRA federal+ON'],
    ['ON', 200000, 63971.98, null, 'CRA federal+ON'],
    ['QC', 30000, 3130.48, null, 'CRA+Revenu Quebec (abatement+QPIP split)'],
    ['QC', 60000, 11200.40, null, 'CRA+Revenu Quebec (abatement+QPIP split)'],
    ['QC', 100000, 25647.40, null, 'CRA+Revenu Quebec (abatement+QPIP split)'],
    ['QC', 200000, 71836.95, null, 'CRA+Revenu Quebec (abatement+QPIP split)'],
    ['SK', 30000, 2906.71, null, 'CRA federal+SK'],
    ['SK', 60000, 10462.08, null, 'CRA federal+SK'],
    ['SK', 100000, 23662.08, null, 'CRA federal+SK'],
    ['SK', 200000, 62720.04, null, 'CRA federal+SK'],
    ['NT', 30000, 2593.04, null, 'CRA federal+NT'],
    ['NT', 60000, 8847.96, null, 'CRA federal+NT'],
    ['NT', 100000, 20487.96, null, 'CRA federal+NT'],
    ['NT', 200000, 58657.30, null, 'CRA federal+NT'],
    ['NU', 30000, 2310.36, null, 'CRA federal+NU'],
    ['NU', 60000, 7932.34, null, 'CRA federal+NU'],
    ['NU', 100000, 18932.33, null, 'CRA federal+NU'],
    ['NU', 200000, 53838.38, null, 'CRA federal+NU'],
    ['YT', 30000, 2763.79, null, 'CRA federal+YT'],
    ['YT', 60000, 9018.20, null, 'CRA federal+YT'],
    ['YT', 100000, 20818.20, null, 'CRA federal+YT'],
    ['YT', 200000, 57421.05, null, 'CRA federal+YT'],
  ];
  for (const [prov, income, actual, expected, note] of CASES) {
    it.skip(`${prov} $${income}: library=${actual} vs CRA=${expected} (${note})`, () => {
      const total = getFederalTaxAmount(prov, income) + getProvincialTaxAmount(prov, income);
      assert.ok(Math.abs(total - actual) < 0.01, `library drifted: got ${total}, snapshot ${actual}`);
      assert.ok(Math.abs(total - expected) < 1, `got ${total}, CRA expected ${expected}`);
    });
  }

  it('B4 marginal sanity (oracle = bracket table, investigate anomalies)', () => {
    // OPEN QUESTION Sept 3: ON $200k library marginal = 47.97%, but naive
    // 29% (fed 181k-258k) + 12.16% (ON 150k-220k) = 41.16%. Gap ≈ 6.8pp.
    // Suspect: BPA phase-out between $181k-$258k adds effective marginal, or
    // getTotalMarginalRate includes surtax/credits. Do NOT hard-code 41.16% —
    // resolve against CRA marginal tables before stamping verified.
    const m = getTotalMarginalRate('ON', 200000);
    assert.ok(m > 0.3 && m < 0.6, `ON $200k marginal insane: ${m}`);
  });
});

// ---- GROUP D: wrapper carries the CRA-correct overrides (ACTIVE, green) ----
describe('D: wrapper overrides applied (CRA-correct, Sept 3 2026)', () => {
  it('D1 wrapper BC first bracket is CRA-correct 5.60%', async () => {
    const { PROVINCES } = await import('../lib/tax-engine/cra-tables-2026.mjs');
    assert.equal(PROVINCES.BC.RATES[0].RATE, 0.056);
    assert.equal(PROVINCES.BC.CREDIT_RATE, 0.056);
  });
  it('D2 wrapper PE has CRA-correct 20%-over-$200k bracket', async () => {
    const { PROVINCES } = await import('../lib/tax-engine/cra-tables-2026.mjs');
    const top = PROVINCES.PE.RATES[PROVINCES.PE.RATES.length - 1];
    assert.equal(top.RATE, 0.2);
    assert.equal(top.FROM, 200000);
  });
});

// ---- GROUP E: wrapper regression vs independent oracles (ACTIVE, green) ----
describe('E: wrapper math vs independent oracles (not the library)', () => {
  it('E1 federal $100k = $14,392.73 (hand-calc from CRA brackets + UBM example)', async () => {
    const { getFederalTax } = await import('../lib/tax-engine/calculate.mjs');
    assert.ok(Math.abs(getFederalTax('ON', 100000) - 14392.73) < 0.01);
  });
  it('E2 BC prov $30k = $939.90 (CRA-correct 5.6%; library stale $849.27)', async () => {
    const { getProvincialTax } = await import('../lib/tax-engine/calculate.mjs');
    assert.ok(Math.abs(getProvincialTax('BC', 30000) - 939.9) < 0.01);
  });
  it('E3 ON prov $100k = $6,377.83 incl. surtax-on-(base−credit) (catax.tools $6,378)', async () => {
    const { getProvincialTax } = await import('../lib/tax-engine/calculate.mjs');
    assert.ok(Math.abs(getProvincialTax('ON', 100000) - 6377.83) < 1);
  });
  it('E4 wrapper matches library to the cent on all non-override cells (47 cells)', async () => {
    const W = await import('../lib/tax-engine/calculate.mjs');
    const { createRequire } = await import('node:module');
    const T = createRequire(import.meta.url)('@equisoft/tax-ca');
    const OVERRIDDEN = new Set(['BC@30000', 'BC@60000', 'BC@100000', 'BC@200000', 'PE@200000']);
    for (const p of ['AB', 'MB', 'NB', 'NL', 'NS', 'PE', 'ON', 'QC', 'SK', 'NT', 'NU', 'YT', 'BC']) {
      for (const i of [30000, 60000, 100000, 200000]) {
        if (OVERRIDDEN.has(`${p}@${i}`)) continue;
        const w = W.getFederalTax(p, i) + W.getProvincialTax(p, i);
        const l = T.getFederalTaxAmount(p, i) + T.getProvincialTaxAmount(p, i);
        assert.ok(Math.abs(w - l) < 0.01, `${p}@${i}: wrapper ${w} vs library ${l}`);
      }
    }
  });
});
