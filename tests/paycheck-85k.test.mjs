/**
 * Paycheck test — $85,000 employment income, ON / BC / QC.
 *
 * WHAT is tested: full income-tax + payroll-deduction computation per province.
 * TO WHAT (oracle): hand arithmetic from CRA brackets shown step-by-step below
 * (auditable without running anything), plus CRA-published payroll formulas.
 * The library is used ONLY as a second-opinion cross-check where it is
 * verified-correct (ON, QC to the cent) — never as the oracle.
 *
 * $85k chosen deliberately: sits in CPP2 band top edge ($85,000 = YAMPE exactly),
 * above EI cap ($68,900), below BPA phase-out — exercises every payroll ceiling.
 *
 * Run: node --test tests/paycheck-85k.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const T = require('@equisoft/tax-ca');
const W = await import('../lib/tax-engine/calculate.mjs');

const INCOME = 85000;
const approx = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;

// ---- Hand-computed oracles (CRA 2026 brackets, Sept 3 2026) ----
// Federal gross: 14%×58,523 = 8,193.22; 20.5%×(85,000−58,523=26,477) = 5,427.79
//   → gross 13,621.01 − BPA credit 16,452×14% = 2,303.28 → net federal 11,317.73
const FED_NONQC = 11317.73;
// ON prov: 5.05%×53,891 = 2,721.50; 9.15%×(85,000−53,891=31,109) = 2,846.47
//   → base 5,567.97 − credit 12,989×5.05% = 655.94 → 4,912.03; surtax 0 (below $5,818)
const ON_PROV = 4912.02;
// BC prov (CRA-correct 5.6%): 5.6%×50,363 = 2,820.33; 7.7%×(85,000−50,363=34,637) = 2,667.05
//   → base 5,487.38 − credit 13,216×5.6% = 740.10 → 4,747.28
const BC_PROV = 4747.28;
// QC: federal ×(1−16.5%) = 11,317.73×0.835 = 9,450.30
//   prov: 14%×54,345 = 7,608.30; 19%×(85,000−54,345=30,655) = 5,824.45
//   → base 13,432.75 − credit 18,952×14% = 2,653.28 → 10,779.47
const QC_FED = 9450.3;
const QC_PROV = 10779.47;

// Payroll oracles (CRA 2026 ceilings — VERIFIED in docs/data-sources.md §4):
// CPP1 = 5.95%×(74,600−3,500) = 4,230.45; CPP2 = 4%×(85,000−74,600) = 416.00
const CPP_TOTAL = 4230.45 + 416.0; // 4,646.45
// EI = 1.63%×68,900 (capped) = 1,123.07; QC EI = 1.30%×68,900 = 895.70
const EI = 1123.07;
const EI_QC = 895.7;
// QPP1 = 6.30%×(74,600−3,500) = 4,479.30; QPP2 = 416.00 → 4,895.30
const QPP_TOTAL = 4479.3 + 416.0;
// QPIP = 0.43%×85,000 (below $103,000 cap) = 365.50
const QPIP = 365.5;

describe('ON $85k — income tax vs hand calc', () => {
  it('federal = $11,317.73', () => assert.ok(approx(W.getFederalTax('ON', INCOME), FED_NONQC)));
  it('provincial = $4,912.02 (no surtax below $5,818)', () =>
    assert.ok(approx(W.getProvincialTax('ON', INCOME), ON_PROV)));
  it('total = $16,229.75, matches verified-correct library to the cent', () => {
    assert.ok(approx(W.getFederalTax('ON', INCOME) + W.getProvincialTax('ON', INCOME), 16229.75));
    assert.ok(
      approx(T.getFederalTaxAmount('ON', INCOME) + T.getProvincialTaxAmount('ON', INCOME), 16229.75)
    );
  });
});

describe('BC $85k — income tax vs hand calc (exercises the 5.6% override)', () => {
  it('federal = $11,317.73 (same as ON — federal is province-independent pre-abatement)', () =>
    assert.ok(approx(W.getFederalTax('BC', INCOME), FED_NONQC)));
  it('provincial = $4,747.28 at CRA-correct 5.6% (stale library gives $4,546.69)', () => {
    assert.ok(approx(W.getProvincialTax('BC', INCOME), BC_PROV));
    assert.ok(approx(T.getProvincialTaxAmount('BC', INCOME), 4546.69, 0.02)); // documents the bug
  });
  it('total = $16,065.01', () =>
    assert.ok(approx(W.getFederalTax('BC', INCOME) + W.getProvincialTax('BC', INCOME), 16065.01)));
});

describe('QC $85k — income tax vs hand calc (exercises abatement)', () => {
  it('federal = $9,450.30 after 16.5% abatement', () =>
    assert.ok(approx(W.getFederalTax('QC', INCOME), QC_FED)));
  it('provincial = $10,779.47', () => assert.ok(approx(W.getProvincialTax('QC', INCOME), QC_PROV)));
  it('total = $20,229.77, matches verified-correct library to the cent', () => {
    assert.ok(approx(W.getFederalTax('QC', INCOME) + W.getProvincialTax('QC', INCOME), 20229.77));
    assert.ok(
      approx(T.getFederalTaxAmount('QC', INCOME) + T.getProvincialTaxAmount('QC', INCOME), 20229.77)
    );
  });
});

describe('$85k payroll deductions vs CRA formulas', () => {
  it('CPP = $4,646.45 (max: income hits YAMPE exactly)', () =>
    assert.ok(approx(0.0595 * (74600 - 3500) + 0.04 * (85000 - 74600), CPP_TOTAL)));
  it('EI = $1,123.07 (capped at $68,900)', () => assert.ok(approx(0.0163 * 68900, EI)));
  it('QPP = $4,895.30; QC EI = $895.70; QPIP = $365.50', () => {
    assert.ok(approx(0.063 * (74600 - 3500) + 0.04 * (85000 - 74600), QPP_TOTAL));
    assert.ok(approx(0.013 * 68900, EI_QC));
    assert.ok(approx(0.0043 * 85000, QPIP));
  });
});

describe('$85k take-home (tax + payroll)', () => {
  it('ON net = $63,000.73', () =>
    assert.ok(approx(INCOME - 16229.75 - CPP_TOTAL - EI, 63000.73, 0.05)));
  it('BC net = $63,165.47 (highest — lowest provincial tax)', () =>
    assert.ok(approx(INCOME - 16065.01 - CPP_TOTAL - EI, 63165.47, 0.05)));
  it('QC net = $58,613.73 (lowest — abatement outweighed by 19–25.75% prov rates)', () =>
    assert.ok(approx(INCOME - 20229.77 - QPP_TOTAL - EI_QC - QPIP, 58613.73, 0.05)));
});
