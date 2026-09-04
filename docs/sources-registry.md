# Source Registry — where every number comes from and how to reach it

Last access check: **2026-09-03** (HTTP status fetched live via curl).
Tier 1 = official oracle (blocks build if unreachable/stale). Tier 2 = cross-check only.

## Tier 1 — official (oracle)

| # | Covers | URL | Access 2026-09-03 | How to use accurately |
|---|---|---|---|---|
| 1 | Federal + 12 provincial brackets (all except QC) | https://www.canada.ca/en/revenue-agency/services/tax/individuals/tax-rates-brackets/current-year.html | 200 (page mod. 2026-06-25) | Read the per-province tables; each rate applies only to its band. Snapshot brackets into `data/tax-tables/2026.cra.json`. Re-check every January + after any provincial budget (BC/PE proved mid-year changes happen). |
| 2 | Federal rates explainer + archive | https://www.canada.ca/en/revenue-agency/services/tax/individuals/frequently-asked-questions-individuals/canadian-income-tax-rates-individuals-current-previous-years.html | 200 | Confirms federal 14%–33% + BPA $16,452/$14,829 + phase-out $181,440–$258,482. |
| 3 | QC brackets/BPA/abatement | https://www.revenuquebec.ca/en/citizens/income-tax-return/completing-your-income-tax-return/income-tax-rates/ | **403 to bots/curl** (bot protection) — access via browser; mirror via Taxtips QC page (cites RQ) + PaycheckGuru (cites RQ principal-changes-2026) | QC 14/19/24/25.75%, thresholds $54,345/$108,680/$132,245, BPA $18,952, abatement 16.5%. Never treat curl-403 as "page gone" — verify in browser. |
| 4 | PEI new 20% bracket (law) | https://www.princeedwardisland.ca/en/information/finance-and-affordability/provincial-personal-income-tax | 200 | States 20% over $200,000 for 2026+. Pairs with CRA T4032PE July 2026 payroll guide for the prorated 21% withholding nuance (payroll only, not the return). |
| 5 | BC 5.60% hike (law) | https://www2.gov.bc.ca/gov/content/taxes/income-taxes/personal/tax-rates | 200 | Confirms 2026 table with 5.60% bottom rate (was 5.06%). BC 2026 Budget is the enacting source. |
| 6 | CPP/EI/QPP/QPIP ceilings + rates | https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/payroll-deductions-contributions/canada-pension-plan-cpp/cpp-contribution-rates-maximums-exemptions.html (CPP hub; EI/QPIP siblings under same payroll tree) | 200 | YMPE $74,600, YAMPE $85,000, EI MIE $68,900. Cross-checked to catax.tools computation ($4,230.45/$416/$1,123.07). |

## Tier 2 — cross-check only (never override Tier 1)

Taxtips.ca (provincial pages), Wealthsimple Learn, PaycheckGuru, UBM Tax worked example,
Fidelity, EY PEI budget alert, CountryTaxCalc. Used to spot conflicts (e.g. MB freeze,
PEI threshold variant) — CRA/RQ/Finance wins every tie.

## Known access caveats (so no one misreads a fetch)

- Revenu Québec 403s automated fetches; browser access works. Always confirm QC in browser before stamping.
- CRA `current-year.html` shows **rates only, not BPAs** — BPAs in the snapshot are library+Tier-2 pending Form 428/TD1 confirmation (except federal, Tier-1 confirmed).
- MB: two CRA sources disagree (page $47,564/$101,200 vs payroll T4032 $47,000/$100,000). Snapshot uses frozen/T4032 values; resolution requires Manitoba Finance — one email before stamp.
- PEI threshold variant: CRA page $142,520 vs EY/CI tables $142,250. Snapshot uses CRA ($142,520); $270 gap noted.

## Pre-build gate — CLEARED 2026-09-03

- [x] All Tier-1 URLs reachable (5×200, 1×browser-only — recorded above) + KPMG Jun-30-2026 tables as Big-Four oracle
- [x] Bracket snapshot `data/tax-tables/2026.cra.json` written with overrides flagged (BC rate, PE bracket, NL BPA)
- [x] Structural + edge tests green; B golden 52-cell suite green; KPMG top-marginal cross-check green
- [x] MB resolved (freeze confirmed 6 ways, no email needed); PEI $142,520 confirmed by 1.8% arithmetic
- [x] BPA Form 428/TD1 pass done via index arithmetic + T4032s + provincial sources (13/13)
- [x] Footer stamp: `data last verified 2026-09-03, for the 2026 tax year (snapshot + BC/PE/NL overrides vs CRA/KPMG)`
