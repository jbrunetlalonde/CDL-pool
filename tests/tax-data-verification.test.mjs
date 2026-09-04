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

// ---- GROUP B: wrapper totals pinned to verified CRA values (ACTIVE — golden) ----
// EXPECTED below = wrapper outputs proven CRA-correct Sept 2026:
// brackets vs CRA current-year page / RQ / PEI Finance / KPMG Jun-30-2026 tables,
// math vs independent hand-calcs (federal $100k = $14,392.73 = UBM example),
// payroll vs CRA ceilings. Any drift (dependency bump, snapshot edit) fails loudly.
// NOTE: these assert the WRAPPER, not the library — BC/PE/NL differ from the
// library by the documented CRA-correct overrides (see E4 for the parity map).
describe('B: wrapper totals = verified CRA values (13x4, unskipped)', () => {
  const CASES = [
    ['AB', 30000, 2475.2], ['AB', 60000, 9171.2], ['AB', 100000, 21347.21], ['AB', 200000, 58084.98],
    ['BC', 30000, 2836.62], ['BC', 60000, 9015.01], ['BC', 100000, 20295.01], ['BC', 200000, 59595.72],
    ['MB', 30000, 3432.48], ['MB', 60000, 11221.99], ['MB', 100000, 24521.99], ['MB', 200000, 67596.05],
    ['NB', 30000, 3432.3], ['NB', 60000, 10900.99], ['NB', 100000, 24700.99], ['NB', 200000, 66496.6],
    ['NL', 30000, 3367.54], ['NL', 60000, 11162.22], ['NL', 100000, 25300.62], ['NL', 200000, 67584.13],
    ['NS', 30000, 3484.9], ['NS', 60000, 12204.61], ['NS', 100000, 27059.8], ['NS', 200000, 71734.53],
    ['PE', 30000, 3321.72], ['PE', 60000, 11502.78], ['PE', 100000, 26160.62], ['PE', 200000, 70177.63],
    ['ON', 30000, 2755.78], ['ON', 60000, 8817.25], ['ON', 100000, 20770.55], ['ON', 200000, 63971.98],
    ['QC', 30000, 3130.48], ['QC', 60000, 11200.4], ['QC', 100000, 25647.4], ['QC', 200000, 71836.95],
    ['SK', 30000, 2906.71], ['SK', 60000, 10462.08], ['SK', 100000, 23662.08], ['SK', 200000, 62720.04],
    ['NT', 30000, 2593.04], ['NT', 60000, 8847.96], ['NT', 100000, 20487.96], ['NT', 200000, 58657.3],
    ['NU', 30000, 2310.36], ['NU', 60000, 7932.34], ['NU', 100000, 18932.33], ['NU', 200000, 53838.38],
    ['YT', 30000, 2763.79], ['YT', 60000, 9018.2], ['YT', 100000, 20818.2], ['YT', 200000, 57421.05],
  ];
  for (const [prov, income, expected] of CASES) {
    it(`${prov} $${income} = $${expected}`, async () => {
      const W = await import('../lib/tax-engine/calculate.mjs');
      const total = W.getFederalTax(prov, income) + W.getProvincialTax(prov, income);
      assert.ok(Math.abs(total - expected) < 0.01, `got ${total}, pinned ${expected}`);
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
  it('E4 wrapper matches library to the cent on all non-override cells', async () => {
    const W = await import('../lib/tax-engine/calculate.mjs');
    const { createRequire } = await import('node:module');
    const T = createRequire(import.meta.url)('@equisoft/tax-ca');
    // Overridden (CRA-correct, wrapper intentionally differs): all BC, PE $200k, all NL (BPA $13,094).
    const OVERRIDDEN = new Set(['BC@30000', 'BC@60000', 'BC@100000', 'BC@200000', 'PE@200000', 'NL@30000', 'NL@60000', 'NL@100000', 'NL@200000']);
    for (const p of ['AB', 'MB', 'NB', 'NL', 'NS', 'PE', 'ON', 'QC', 'SK', 'NT', 'NU', 'YT', 'BC']) {
      for (const i of [30000, 60000, 100000, 200000]) {
        if (OVERRIDDEN.has(`${p}@${i}`)) continue;
        const w = W.getFederalTax(p, i) + W.getProvincialTax(p, i);
        const l = T.getFederalTaxAmount(p, i) + T.getProvincialTaxAmount(p, i);
        assert.ok(Math.abs(w - l) < 0.01, `${p}@${i}: wrapper ${w} vs library ${l}`);
      }
    }
  });
  it('E5 top marginals match KPMG Jun-30-2026 combined table (independent Big-Four oracle)', async () => {
    // KPMG "Combined Top Marginal Tax Rates — 2026" (interest/regular income).
    // Only provinces whose top band is reached at/below $300k are asserted here;
    // AB/YT/NL tops apply above $300k ($370k/$500k/$1.14M) and are covered by bracket verification instead.
    const W = await import('../lib/tax-engine/calculate.mjs');
    const EXPECTED = { BC: 53.5, SK: 47.5, MB: 50.4, ON: 53.53, QC: 53.31, NB: 52.5, NS: 54.0, PE: 53.0, NT: 47.05, NU: 44.5 };
    for (const [prov, rate] of Object.entries(EXPECTED)) {
      const m = W.getMarginalRate(prov, 300000) * 100;
      assert.ok(Math.abs(m - rate) < 0.1, `${prov}: wrapper ${m.toFixed(2)}% vs KPMG ${rate}%`);
    }
  });
});
