# Data Sources — 2026 Tax Year (to be verified before any UI build)

> Rule: nothing ships until every row below is `verified` with a CRA URL + date + passing test.
> Upstream: `@equisoft/tax-ca@2026.10.0` (pinned `~2026.10.0`). Our wrapper never trusts it blindly.

## 1. What tax-ca 2026.10.0 ships (actuals, dumped Sept 3 2026)

### Federal (CA)
- Brackets: 14% to $58,523 → 20.5% to $117,045 → 26% to $181,440 → 29% to $258,482 → 33% above
- BPA: `{MIN:14829, MAX:16452}` (phase-out range, not a single number)
- Credit rate: 0.14

### Provincials (all 13 present in TAX_BRACKETS)
| Prov | BPA | First bracket | Top rate (dump) |
|---|---|---|---|
| AB | 22769 | 8% to $61,200 | 15% over $370,220 |
| BC | 13216 | 5.06% to $50,363 | 20.5% over $265,545 |
| MB | 15780 | 10.8% to $47,000 | 17.4% over $100,000 |
| NB | 13664 | 9.4% to $52,333 | 19.5% over $193,861 |
| NL | 11188 | 8.7% to $44,678 | 21.8% over $1,141,275 |
| NS | 11932 | 8.79% to $30,995 | 21% over $157,124 |
| PE | 15000 | 9.5% to $33,928 | 19% over $142,250 |
| ON | 12989 | 5.05% to $53,891 | 13.16% over $220,000 |
| QC | 18952 | 14% to $54,345 | 25.75% over $132,245 |
| SK | 20381 | 10.5% to $54,532 | 14.5% over $155,805 |
| NT | 18198 | 5.9% to $53,003 | 14.05% over $172,346 |
| NU | 19659 | 4% to $55,801 | 11.5% over $181,439 |
| YT | 16452 | 6.4% to $58,523 | 15% over $500,000 |

Full `RATES` arrays: run `node scripts/dump-tax-data.mjs`.

### Payroll / limits (actuals)
- CPP: YMPE $74,600, YAMPE $85,000, exempt $3,500, base 5.95%, step2 4%
- QPP: YMPE $74,600, YAMPE $85,000, exempt $3,500, base 6.3%, step2 4%
- EI: MIE $68,900, 1.63% (0.013 QC)
- QPIP: MIE $103,000, salaried 0.43% / self-employed 0.764%
- RRSP max $33,810, TFSA $7,000 (UPDATE_YEAR 2024 — confirm 2026), RESP $50,000 + CESG 20% max $7,200

## 2. Verification matrix (ACTUAL = library claim, EXPECTED = you fill from CRA)

Formula under test: `getFederalTaxAmount(prov, income) + getProvincialTaxAmount(prov, income)` (income tax only, no CPP/EI).

| Province | $30k ACTUAL | $30k EXPECTED (CRA) | $60k ACTUAL | $60k EXPECTED | $100k ACTUAL | $100k EXPECTED | $200k ACTUAL | $200k EXPECTED | Status |
|---|---|---|---|---|---|---|---|---|---|
| AB | 2475.20 | TBD | 9171.20 | TBD | 21347.21 | TBD | 58084.98 | TBD | ☐ |
| BC | 2745.99 | TBD | 8814.41 | TBD | 20094.41 | TBD | 59395.13 | TBD | ☐ |
| MB | 3432.48 | TBD | 11221.99 | TBD | 24521.99 | TBD | 67596.05 | TBD | ☐ |
| NB | 3432.30 | TBD | 10900.99 | TBD | 24700.99 | TBD | 66496.60 | TBD | ☐ |
| NL | 3533.36 | TBD | 11328.05 | TBD | 25466.44 | TBD | 67749.95 | TBD | ☐ |
| NS | 3484.90 | TBD | 12204.61 | TBD | 27059.80 | TBD | 71734.53 | TBD | ☐ |
| PE | 3321.72 | TBD | 11502.78 | TBD | 26160.62 | TBD | 70181.35 | TBD | ☐ |
| ON | 2755.78 | TBD | 8817.25 | TBD | 20770.55 | TBD | 63971.98 | TBD | ☐ |
| QC | 3130.48 | TBD | 11200.40 | TBD | 25647.40 | TBD | 71836.95 | TBD | ☐ (+QPIP) |
| SK | 2906.71 | TBD | 10462.08 | TBD | 23662.08 | TBD | 62720.04 | TBD | ☐ |
| NT | 2593.04 | TBD | 8847.96 | TBD | 20487.96 | TBD | 58657.30 | TBD | ☐ |
| NU | 2310.36 | TBD | 7932.34 | TBD | 18932.33 | TBD | 53838.38 | TBD | ☐ |
| YT | 2763.79 | TBD | 9018.20 | TBD | 20818.20 | TBD | 57421.05 | TBD | ☐ |

How to verify a cell: look up CRA federal + provincial tables for that income, compute by hand (or Taxtips cross-check), put in EXPECTED, unskip the matching `it.skip` in `tests/tax-data-verification.test.mjs`, run `npm run verify`. Tolerance: ±$1.

Edge cases (must pass before build):
- [ ] Federal BPA phase-out: $150k vs $200k vs $260k (MIN/MAX logic)
- [ ] CPP2 band: $80k income hits YMPE–YAMPE 4% step2
- [ ] EI max-out: income above $68,900 caps EI
- [ ] QC: EI 1.3% + QPIP (not 1.63%), QPP 6.3% (not 5.95%)
- [ ] YT thresholds mirror federal ($58,523 etc.) — confirm intentional
- [ ] $0.01 bracket edges (e.g. $58,523 vs $58,523.01 federal)

## 3. CRA source URLs (fill date pulled per row)

- Federal brackets/BPA: https://www.canada.ca/en/revenue-agency/services/tax/individuals/frequently-asked-questions-individuals/canadian-income-tax-rates-individuals-current-previous-years.html
- Provincial brackets/BPAs: same CRA page + Revenu Québec for QC
- CPP/QPP (YMPE/YAMPE/rates): https://www.canada.ca/en/revenue-agency/services/tax/canada-pension-plan-cpp-employment-insurance-ei-ruling/cpp-contributions.html
- EI/QPIP: CRA payroll page + https://www.rqap.gouv.qc.ca/ (QPIP)
- TFSA/RRSP/FHSA/RESP/CESG: CRA registered plans pages
- Cross-checks (not oracles): https://www.taxtips.ca, WealthSimple calculator, howmuch.tax/canada

## 4. Verification report — Sept 3, 2026 (done by agent vs official sources)

Method: dumped `tax-ca@2026.10.0`, compared bracket-by-bracket to CRA
`current-year.html` (modified 2026-06-25), Revenu Québec 2026 rates, PEI Finance
Budget 2026 + CRA T4032PE (July 2026), BC 2026 Budget / gov.bc.ca, CRA payroll
tables (T4032MB), Taxtips.ca as cross-check only. Independent math re-computed
federal tax from raw CRA brackets (no library functions).

- Federal: library `14392.73` at $100k = independent hand-calc `14392.73` = UBM worked example. **VERIFIED.**
- Payroll: CPP YMPE $74,600 / YAMPE $85,000 @5.95%+4%, QPP 6.3%, EI $68,900 @1.63%/1.30% QC, QPIP $103,000 — all match CRA/catax.tools. **VERIFIED.**

| Prov | Brackets vs CRA | BPA | Verdict |
|---|---|---|---|
| AB | 6 brackets match | 22769 | ✅ VERIFIED |
| BC | CRA 5.60% first bracket; library 5.06% (2025 rate, stale) | 13216 matches | ❌ FAIL — undercharges ~$91 at $30k; needs wrapper override to 5.60% |
| MB | CRA page $47,564/$101,200 vs CRA payroll T4032 $47,000/$100,000 (frozen); library = $47,000/$100,000 = T4032 + Taxtips frozen | 15780 matches | ⚠️ CONFLICT — two CRA sources disagree; library matches payroll tables + freeze policy, likely correct; confirm with Manitoba Finance before stamp |
| NB | match | 13664 | ✅ VERIFIED |
| NL | match (8 brackets) | 11188 | ✅ VERIFIED |
| NS | match | 11932 | ✅ VERIFIED |
| PE | CRA 6 brackets incl. new 20% over $200,000 (Apr 14 2026 budget, T4032PE July 2026); library 5 brackets tops at 19%, threshold $142,250 vs CRA $142,520 | 15000 matches | ❌ FAIL for >$142k (matters at $200k case); ≤$100k cells unaffected |
| ON | match | 12989 | ✅ VERIFIED |
| QC | 14/19/24/25.75% + thresholds match Revenu Québec; BPA $18,952, abatement 16.5% | 18952 | ✅ VERIFIED (brackets; abatement math covered by B-suite) |
| SK | match | 20381 | ✅ VERIFIED |
| NT | match | 18198 | ✅ VERIFIED |
| NU | match | 19659 | ✅ VERIFIED |
| YT | match (mirrors federal thresholds — intentional) | 16452 | ✅ VERIFIED |

**Bottom line: 10/13 provinces + federal + payroll VERIFIED. Phase 1 blocked only by:**
1. BC first-bracket override (5.06% → 5.60%, + credit rate) in `lib/tax-engine/`.
2. PE 20%-over-$200k bracket addition (+ $142,520 threshold correction).
3. MB one-line confirmation with Manitoba Finance (expected: frozen $47,000/$100,000 = library correct).

## 5. Sign-off

- [x] All 14 jurisdictions dumped (see §1)
- [x] Bracket-level verification vs CRA done (see §4) — 10/13 green, 2 known FAILs, 1 conflict
- [ ] 52-cell $ hand-computed totals filled + B-suite unskipped (ACTUALs pre-filled in tests; EXPECTED_CRA = TBD until (1)–(3) resolved)
- [ ] Edge cases green (C-suite green except B4 marginal anomaly under investigation)
- [ ] Footer stamp ready once reds clear: `data last verified [date], for the 2026 tax year (tax-ca 2026.10.0 + BC/PE overrides vs CRA)`
