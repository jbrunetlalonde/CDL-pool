# PRD — Canadian Income Tax Calculator & Financial Insights Web App

**Status:** Draft v1 for planning
**Owner:** [you]
**Last updated:** September 2026

---

## 1. Executive Summary

A free, fast, mobile-friendly web app that does three things:

1. **Tax Calculator** — enter your income (and a few details), instantly see federal + provincial income tax, take-home pay, marginal vs. average rate, and a visual breakdown by bracket. Modeled after howmuch.tax, but Canada-first.
2. **Financial Insights** — a short, rules-based questionnaire ("Do you have kids? Do you own a home? Are you saving for retirement?") that surfaces relevant registered-account opportunities (RESP, FHSA, TFSA, RRSP) with rough dollar-value estimates of what the person could be saving in tax/grants by using them.
3. **Scenario Planner** — takes the after-tax income already calculated and lets someone model two concrete decisions: *"can I invest, and where?"* (with a compound-growth chart) and *"how much do I need to save for a big purchase like a home?"* (down payment savings target, or a simple rent-affordability check).

No accounts, no login, nothing saved server-side — everything works anonymously, and results are shareable via URL rather than a saved profile. Canada only for v1. Architecture should not block a future multi-country expansion, but nothing in v1 should be built specifically to accommodate it yet.

---

## 2. Audit — What howmuch.tax Does Well (and What We're Borrowing)

Updated with a real HAR capture + DevTools screenshot from the `/canada` page — this is now a confirmed technical audit, not inference from page metadata.

**Confirmed stack, directly from the network trace:**

- **Next.js (App Router) on Vercel, built with Turbopack.** Chunk filenames literally include `turbopack-5141ccd644a0be7f.js`, and every asset shares the same `?dpl=dpl_FLfAk1mqNp3qnxubJMdoFLAiRsm6` Vercel deployment-ID query param. About as direct a confirmation as you can get without their source repo — validates the stack in §12.
- **React Server Components / App Router prefetching.** Requests like `?_rsc=1tzlk`, `?_rsc=hhtia` — small, mostly-304'd payloads — are Next.js prefetching the next route's data before you click. That's a big part of why navigation feels instant, and it's a framework feature, not custom engineering — Next.js gives it to us too, for free.
- **No calculation API call anywhere in the capture.** 40 requests total, and none of them is a "calculate my tax" endpoint. This directly confirms what §9 already assumed: bracket data ships inside the JS bundle and every calculation runs synchronously in the browser. The two ~650KB chunks (`ed4489a7...js`, `146a9047...js`) are almost certainly where their bundled tax tables and calc logic live.
- **Self-hosted fonts, no Google Fonts request** — two hashed `.woff2` files served from their own domain, standard `next/font` behaviour. Cheap perf win, easy to copy.
- **Supabase, confirmed directly — but not for accounts.** A real REST call to `kqvmsmpmxpjdmqxavbtk.supabase.co/rest/v1/feedback` — Supabase's auto-generated API hitting a `feedback` table. It's used for a lightweight "was this helpful?" widget: `vote` + `comment` columns, keyed by `page` and an anonymous `user_fingerprint` rather than a login. The `406`/`PGRST116` ("0 rows") response is the classic Supabase "no match" error — they're checking whether this anonymous visitor already voted on this page before showing the widget's state. A genuinely good, cheap pattern to copy for our own anonymous feedback widget (§8) — without ever needing full accounts.
- **`api.exchangerate-api.com/v4/latest/CAD`** — a real, free-tier currency API called even on the Canada page, almost certainly shared infrastructure for their `/compare` cross-country tool. Relevant to us for Phase 4, not v1.
- **PostHog for analytics/feature flags** (`us.i.posthog.com`, `us-assets.i.posthog.com`). Worth noting: in your capture, all three PostHog calls show `(blocked:other)` — they got blocked, almost certainly by a privacy extension. Real tradeoff: PostHog bundles analytics *and* feature flags in one tool, but it's a common ad-blocker target, so a meaningful slice of visits silently produce no data. Vercel Analytics/Plausible (§12) tend to survive more of those blocklists — worth weighing.
- **Cache-heavy, not a cold load.** The capture shows 40 requests but only 2.1 kB actually transferred against 3.1 MB of resources — almost everything came from memory/disk cache or a `304`. This confirms *what* they load and *how* it's built, but not their true cold-load number — worth a hard-refresh HAR later if that specific figure matters.

**A pattern worth adding to our own plan:** an anonymous per-page feedback widget (thumbs up/down + optional comment), stored in a small, single-purpose Supabase table keyed by an anonymous fingerprint rather than a login, with a check for "did this visitor already respond" before asking again. This doesn't require building out full accounts infrastructure — just one small table — and it gives real signal on which pages/insights people find useful without requiring login. Added to §8.

---

## 3. Goals

- Give a materially better, faster, cleaner experience than existing calculators (howmuch.tax, WealthSimple's calculator, TaxTips.ca).
- Make the "financial insight" layer feel like a smart friend, not a generic blog post — outputs should reference the user's actual numbers.
- Keep the product **cheap to run** and **cheap to maintain** (tax data updates 1x/year, not code rewrites).
- Ship an MVP fast, then iterate.

### Non-goals (v1)

- No user accounts, login, or saved history — the calculator and insights work fully anonymously; results are shareable via URL rather than a saved account.
- No business/self-employed/corporate tax (T2), no capital gains optimization tools, no US or other country support yet.
- No real housing-price data or full budgeting/expense-tracking engine — the Scenario Planner (§7) uses numbers the person types in, not fetched market data or itemized budgets.

---

## 4. Target Users

- Individual Canadian employees/freelancers who want a quick, honest answer to "how much tax will I actually pay" and "what should I be doing with my registered accounts."
- Secondary: people comparing take-home pay across provinces, or modeling a raise/bonus/job offer, or planning a first home purchase.

---

## 5. Core Feature 1 — Tax Calculator

### 5.1 Inputs (v1)

| Field | Notes |
|---|---|
| Province/territory | dropdown, all 13 |
| Employment income | required |
| Self-employment income | optional, separate CPP treatment |
| Other income (investment, rental) | optional |
| RRSP contributions | reduces taxable income |
| Tax year | default current year, allow prior year for comparison |
| Age | affects CPP/basic credits at 65+ |

Keep the *first screen* to income + province only — everything else collapsed under "add more detail" so the tool feels instant, matching howmuch.tax's low-friction entry point (see §2).

### 5.2 Outputs

- Total tax (federal + provincial), CPP/QPP, EI
- Net (take-home) income — annual, monthly, biweekly
- **Marginal tax rate** vs **average (effective) tax rate**
- Visual bracket breakdown (stacked bar or the classic "layered bucket" chart showing how much of each bracket is filled)
- Side-by-side province comparison ("what if you lived in Alberta instead?") — nice-to-have, high perceived value, low build cost since it's just re-running the same function

These outputs — net income and marginal rate, specifically — are what feed directly into the Scenario Planner (§7), so the two features should share one calculation engine, not duplicate logic.

### 5.3 Calculation logic

Pure function, runs 100% client-side (no server round-trip needed just to compute a result):

```
taxableIncome = totalIncome − RRSPdeduction − otherDeductions
federalTax = progressiveBracketCalc(taxableIncome, federalBrackets[year])
provincialTax = progressiveBracketCalc(taxableIncome, provincialBrackets[year][province])
CPP/QPP, EI = statutory formulas (flat rate up to a max)
netIncome = totalIncome − federalTax − provincialTax − CPP − EI
```

Apply non-refundable credits (basic personal amount, employment amount, CPP/EI credit) after computing gross tax.

**Data needed (updated once a year):** federal brackets + BPA, all 13 provincial/territorial bracket tables + BPAs, CPP/EI rates and max insurable earnings. This should live in a versioned JSON/TS config file, not hardcoded in logic — see §9.

Reference figures already confirmed for 2026 (illustrative — verify at build time and again every January):
- Federal: 14% up to $58,523 → 33% over $258,482; Basic Personal Amount up to $16,452 (phased down between $181,440–$258,482).
- TFSA annual limit: $7,000
- RRSP dollar limit: $33,810 (or 18% of prior year's earned income, whichever is lower, plus carry-forward room)
- FHSA: $8,000/year, $40,000 lifetime
- RESP: $50,000 lifetime per beneficiary; CESG = 20% match on first $2,500/year (max $500/year, $7,200 lifetime)
- Home Buyers' Plan (HBP): first-time buyers can withdraw up to $60,000 from an RRSP tax-free to buy a home, repayable over 15 years — referenced again in §7.2

---

## 6. Core Feature 2 — Financial Insights Engine

### 6.1 Concept

A short, optional questionnaire (5–8 questions, one at a time, mobile-friendly, skippable) that runs **after** the tax calculation, using the income already entered. Rules-based (no AI needed, no ambiguity, fully auditable) — a decision table, not a chatbot.

### 6.2 Example question → insight mappings

| Question | If yes / relevant condition | Insight shown |
|---|---|---|
| Do you have kids under 18? | Yes, and no RESP mentioned | "Contributing $2,500/yr to an RESP unlocks the $500/yr Canada Education Savings Grant — that's free money you're currently leaving on the table. Over 10 years that's ~$5,000 in grants alone." |
| Are you saving for a first home? | Yes | "An FHSA lets you contribute up to $8,000/yr (tax-deductible, like an RRSP) and withdraw tax-free for a first home. At your income (~X% marginal rate), maxing it out this year would save you ~$Y in tax." → links directly into the Scenario Planner (§7) to show it as a chart |
| Do you have unused RRSP room? | Income entered, no RRSP contribution entered | "Based on your income, you likely have RRSP room. Contributing $X would drop you from the Y% to the Z% bracket and save ~$W in tax." |
| Do you have a TFSA? | Any | Explain TFSA vs RRSP tradeoff based on current marginal rate (TFSA generally favoured at lower incomes, RRSP at higher). |
| Age 65+? | Yes | Mention age credit, pension income splitting, OAS clawback threshold if income is high. |

Each insight should be **quantified using the user's actual entered income**, not generic — that's the differentiator vs. a static blog post. Since there's no account, this all runs on the numbers already in the current session — nothing is saved or re-used across visits.

### 6.3 Design principle

Every insight card should be traceable to a simple, explainable rule (if we can't explain *why* in one sentence, don't ship it). This keeps the logic auditable and keeps trust high — see §15.

### 6.4 Relationship to the Scenario Planner (§7)

Think of §6 and §7 as two views of the same rules engine: §6 delivers short, static insight *cards* ("you're leaving grant money on the table"); §7 is the *interactive* follow-through where someone actually models the number — how much to contribute, where, and what it grows into. An insight card in §6 should be able to deep-link straight into the matching §7 scenario, pre-filled.

---

## 7. Core Feature 3 — Scenario Planner

Two focused tools, sharing one UI pattern with the tax calculator (§5): a few inputs, a live result, one clear chart — no multi-step wizard, no account required.

### 7.1 Investment Scenario — "Can I invest, and where?"

**Inputs:**

| Field | Notes |
|---|---|
| Net (after-tax) income | auto-filled from §5, editable |
| Amount available to invest per month | direct user input — deliberately simple; this app doesn't build a full budget/expense tracker (see Non-Goals, §3), the person just states what they can set aside |
| Goal | "General investing / retirement," "Saving for a first home," or "Both" |
| Time horizon | years, slider or input |
| Expected annual return | editable, defaulted to a plain "balanced portfolio" assumption, with a visible note that this is an assumption, not a guarantee |
| Remaining contribution room (optional) | if left blank, assume full annual room from §5.3's reference figures |

**"Where" logic — a rules-based priority waterfall, not a black box:**

1. If the goal includes a first home and FHSA room remains → recommend FHSA first, up to $8,000/yr — it's both a tax deduction now *and* tax-free growth for the home withdrawal, which makes it the clear first stop for that goal.
2. Compare RRSP vs. TFSA using the **actual marginal tax rate already computed in §5** — this is exactly where "based on the province" comes in, since marginal rate differs meaningfully by province even at the same income. Higher marginal rate → the RRSP deduction is worth more today; TFSA tends to win when the marginal rate is already low, or the money might be needed before retirement (no penalty on TFSA withdrawals).
3. Output a simple, explainable order: e.g. *"1) FHSA — $667/mo · 2) RRSP — remainder up to your room · 3) TFSA — remainder"* against whatever monthly amount they entered.

This reuses §6's rules-engine design principle directly (§6.3) — every recommendation traces to one plain-English sentence, same as an insight card, just made interactive.

**Output — compound growth chart:**

- Standard future-value-with-regular-contributions formula, computed client-side, same as the tax engine (§5.3) — no server round-trip.
- Recharts stacked area/line chart over the chosen time horizon, splitting the total into **contributions** vs **growth** — makes visually obvious how much of the end balance is "your money" vs. compounding.
- For an RRSP recommendation specifically: an optional second line showing growth **with the annual tax refund reinvested** vs. without — this is arguably the single most persuasive, honest visual a Canadian tax-advantaged-investing tool can show, and it costs nothing extra to build since it's the same formula run twice with a different contribution input.

### 7.2 Big-Purchase Budgeting — Buying vs. Renting

Two modes under one simple toggle:

**Buying a home:**

| Field | Notes |
|---|---|
| Target home price | user-entered — no live housing-market API in v1 (see Non-Goals, §3); keeps this low-cost and simple |
| Target down payment | presets: 5% / 10% / 20%, or custom |
| Timeframe | years to save |

- **Output:** down payment ÷ timeframe = the direct answer to "how much do I need to save per year" (and per month).
- This number flows straight into §7.1 as a pre-filled scenario ("Here's what you need to save — want to see where to put it?") — the two tools should feel connected, not like three bolted-together calculators.
- A short note referencing the Home Buyers' Plan and FHSA (both already defined in §5.3/§6.2 — reused, not rebuilt) as the recommended vehicles for this specific goal.
- **Land transfer tax** varies a lot by province — Ontario (plus an extra municipal LTT in Toronto specifically) is meaningfully higher than provinces like Alberta or Saskatchewan, which have none. Worth a line-item eventually, but treat it as a v1.1 addition (another small yearly-maintained table, same pattern as §9) rather than something that blocks launch.

**Renting:**

- **Input:** none beyond the net income already known from §5.
- **Output:** a recommended maximum rent using the standard "30% of net income" guideline, shown as one clear number, with a short note that it's a rule of thumb, not a hard rule.

### 7.3 Data & assumptions

The default return-rate assumption, the 30%-of-income rent guideline, and the down-payment presets should live in the same versioned, dated config approach as the tax data in §9 — not hardcoded inline in components — so they're easy to tune later without touching calculation logic.

---

## 8. Design & UX

- You'll provide `design.md` — this PRD assumes: clean, minimal, generous whitespace, a "calculator-first" hero (input box front and center, like howmuch.tax), results appear inline/live as you type (no submit button ideally, debounce recalculation).
- **Responsive breakpoints:** mobile (< 640px), tablet/iPad (640–1024px, both orientations), desktop (> 1024px). iPad specifically: test both portrait and landscape, and make sure charts don't get cramped in portrait split-view.
- Numbers should animate/count up on change — feels alive, reinforces "this is live," cheap to do with Framer Motion.
- Dark mode is a nice low-cost addition if the design system supports it from the start (harder to retrofit).
- **Disclaimer footer** (exact wording, see §15) appears in the global layout so it renders on every page, not just the results view.
- **Lightweight feedback widget** — a small "was this helpful?" thumbs up/down (+ optional comment) on the results/insights view, backed by a small, single-purpose Supabase table keyed on an anonymous fingerprint rather than login. Directly modeled on a pattern confirmed on howmuch.tax itself (§2) — no accounts required, just one small table — and gives real signal on which insights land.
- The Scenario Planner (§7) should visually match the tax calculator (§5): same input-panel-plus-live-result layout, so the whole app reads as one product rather than three separate tools.

---

## 9. Data Architecture

This is the part that actually needs care, because tax data changes yearly and mistakes here are visible/embarrassing.

- Store all tax-year data (brackets, BPA, CPP/EI rates, contribution limits) as versioned, typed config — e.g. `data/tax-tables/2026.ts`, `data/tax-tables/2025.ts` — never inline in calculation logic. **v1 implementation: source this from `@equisoft/tax-ca` (§10.1) pinned to a minor (`~2026.10.0`), re-exported through our own `lib/tax-engine/` wrapper — data change = dependency bump + test run, not a code rewrite.**
- Calculation functions take `(income, province, taxYear)` and look up the right table — this makes adding a year or a new province a data change, not a code change. Wrapper signature stays stable even if upstream export shapes change on a yearly major.
- Extend the same pattern to the Scenario Planner's assumptions (§7.3) — default return rate, rent-affordability guideline, down-payment presets — so every "number we made up" in the app lives in one auditable, dated place.
- Add a lightweight internal "data source" doc noting where each number came from (CRA page, date pulled) so next January's update is a 30-minute task, not a research project.
- No user data is stored anywhere in v1 — calculations happen entirely in-browser and nothing is sent to a server to compute a result. The only server-side data at all is the optional anonymous feedback widget (§8): a vote + optional comment keyed to an anonymous fingerprint, not an account.
- (See §11 for an optional database schema, useful only for DB-driven tax-rate data or the feedback widget — not required for v1.)

---

## 10. APIs & External Services

**Direct answer to "what's the best bet":** split this into two genuinely different problems, because they call for two different kinds of API.

1. **Tax information & deductions** — this is *rules you encode*, not *data you fetch*. There's no live CRA feed to call (see below), and howmuch.tax's own traffic confirms the same conclusion — zero calculation API calls anywhere in their HAR (§2). Their numbers ship inside the JS bundle, same as what §9 already plans for us.
2. **"Insight on potential savings" with accounts and graphs** — this is where it matters whether you mean *generic* insight (no API needed — §6/§7 already cover this using only the income and amounts the person typed in) or *real* insight based on a person's *actual* connected bank/investment accounts. If it's the latter, that's a distinct, well-established API category — account aggregation — and Flinks is the strongest fit for a Canada-first product. Details below. Note this is the *only* scenario where accounts would ever make sense for this product — a deliberate, isolated decision if you ever pursue it, not a general login system.

**Tax calculation — no official CRA API exists.** CRA publishes brackets/credits/limits as static web pages/PDFs each year, not machine-readable feeds. Third-party options exist if you'd rather not maintain the data yourself:

| API | What it's for | Cost | Take |
|---|---|---|---|
| **API Ninjas Income Tax Calculator API** | REST endpoint — pass `country=CA`, income, province, year; get back federal + provincial + payroll-tax breakdown. | Free tier (limited); paid for commercial use | Good for cross-checking your own engine's output in tests. I wouldn't make it the *source of truth* — you'd be trusting a third party's Canada coverage over CRA's own tables, with no way to audit their methodology, for a product whose whole pitch is accurate numbers. |
| **CountryTaxCalc API** | Same idea, broader: 111 countries, one consistent response schema. | Free tier: 1,000 req/month, no card | Worth a look *specifically because of* the Phase 4 multi-country goal — removes the "rewrite the parsing layer per country" problem if you ever expand. Same caveat for Canada specifically: your own hand-verified data (§9) is more trustworthy and costs nothing per request. |

### 10.1 Adopted: `@equisoft/tax-ca` library (evaluated Sept 3, 2026)

Not a REST API — a **bundled data + calculation library**, which is exactly what §9 / this section calls for (ships in JS bundle, zero calc API calls, $0 infra, fully client-side).

- **Repo:** `https://github.com/kronostechnologies/tax-ca` (Kronos → Equisoft, maintained by Equisoft/plan team, Quebec City)
- **Artifacts:** npm `@equisoft/tax-ca` (TS/JS, flat exports, built-in types) + Maven `com.equisoft:tax-ca` (same version, same commit). Kotlin Multiplatform, single `src/commonMain` source of truth.
- **Version at evaluation:** `2026.10.0` (610 versions published, ~601 weekly downloads, 0 dependencies, 876 commits, 27 stars / 6 forks). Major = tax-year dataset (e.g. `2026.x`), minor/patch may still break — lock to minor + test on upgrade per their README.
- **Coverage relevant to v1:** `taxes/IncomeTax` (all federal + 13 provincial/territorial brackets), `BPA`/credits, `CPP`/`QPP`, `EI`, `QPIP`, `OAS`; `investments/` (RRSP, TFSA, RESP grants CESG/CLB/QESI/BCTESG, LIRA/LIF/RRIF); `misc/` (CPI, life expectancy). Each data file carries `Sources` / `Revised` headers — directly satisfies §9's "data source doc" requirement.
- **License:** `LGPL-3.0-only` — acceptable for an npm-installed web app, but flag for review if bundling strategy changes. No copyleft contamination of our own code via normal dynamic linking, but keep dependency isolated in `lib/tax-engine/` and document it.
- **Numeric policy:** `Double` in common code for bit-for-bit JS parity; JVM `BigDecimal`-exact variants exist. For our JS-only v1: round to cents at display boundary, never accumulate floating error across brackets — test with $0.01 edge cases.

**Why adopt over hand-rolled JSON:** (1) Quebec correctness for free (QPP/QPIP often wrong in generic APIs), (2) yearly revision workflow + golden corpus already exists, (3) TS declarations + compatibility gates (`ts-compat/`) enforce stable export shapes, (4) still $0, still anonymous, still no server. We keep our own wrapper + Vitest suite vs CRA examples as the real source of trust — the library is the upstream data feed, not blind trust.

**My actual recommendation (updated): use `@equisoft/tax-ca` as the upstream data + calc foundation for v1, behind our own thin wrapper.** It's the product's core credibility, it's genuinely low-maintenance (bump minor once a year + run §13 suite per §9), and howmuch.tax's own architecture backs this as the right call. Use the two REST APIs above only as a test-suite cross-check, or as Phase 4 infrastructure if you get there.

**Real savings insight, accounts, and graphs — this is account aggregation, a different problem:**

| API | What it's for | Cost | v1 or later |
|---|---|---|---|
| **Flinks** (Canadian, Montreal-based, majority-owned by National Bank) | Connects a user's real bank/investment accounts — balances, transactions, holdings. This is what would let "you could save $X in RRSP room" become "here's your actual unused RRSP room and a real net-worth graph." Best-documented Canadian bank coverage of any aggregator, stronger than Plaid specifically for CA institutions. | Paid, usage-based | Phase 3+ only, and only if pursued — this is the one legitimate reason to add accounts, as a standalone opt-in feature, not v1 |
| **Plaid** | Same category, US-first; covers Canada's major banks but with less depth for CA-specific institutions/account types than Flinks. | Paid, usage-based | Only worth it if you also expand to the US and want one vendor for both markets |
| **Bank of Canada Valet API** | Free, public, no key. Official CPI/inflation series. | Free | Nice-to-have: auto-populate "indexed by X% this year" copy instead of hardcoding it each January |
| **Statistics Canada Web Data Service (WDS)** | Free, public. Average income/wage data by region. | Free | Powers a "your income vs. the Canadian/provincial median" insight — a real differentiator, no account connection required |
| **Local static lookup table** (not an API) | First character of a postal code → province/territory. | Free | v1 — use instead of any API for province auto-detection |
| **IP geolocation** (ipapi.co / ipinfo.io) | Optional province pre-fill on load. | Free tier | Optional, nice-to-have |
| **`api.exchangerate-api.com`** | Currency conversion — confirmed in howmuch.tax's own traffic (§2). | Free tier | Only relevant if/when Phase 4 happens |

**On Flinks specifically, since it's the real answer to "accounts with graphs":** this is meaningfully bigger than anything else in this PRD. It means handling real, regulated financial data instead of numbers a user typed in, it's a paid API, and it needs its own security/compliance pass before shipping. Treat it as a deliberate, standalone Phase 3+ decision once the free, no-account calculator has proven there's demand — and if you go this route, it would be the only reason to add any kind of account system at all.

Everything that actually determines the tax numbers (brackets, BPA, CPP/EI, TFSA/RRSP/FHSA/RESP limits) stays hand-verified, versioned data (§9) — that's the correct, honest approach, not a missing integration.

---

## 11. Database Schema — Optional, Not v1

Accounts are explicitly **not** in v1 (§3). The recommended v1 architecture ships with **no database at all** — everything from §9 (and now §7's Scenario Planner assumptions) runs on static files, entirely client-side. This section is a ready-to-go Postgres schema for *if* that ever changes — e.g. you want DB-driven tax-rate data managed through an admin panel, or you later decide to pursue Flinks-based account linking (§10) and need somewhere to store it. None of it is required to launch.

```sql
-- ── Optional, deferred: accounts + saved history (NOT in v1 — see §3 Non-Goals) ──

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  auth_provider text not null,        -- 'supabase' | 'clerk' | 'google' etc.
  created_at    timestamptz default now()
);

create table scenarios (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references users(id),   -- nullable: supports pure anonymous share-links with no account at all
  name          text,                  -- user-given label, e.g. "My 2026 income" or "House down payment plan"
  share_slug    text unique not null,  -- short random slug for shareable URLs, e.g. /r/x7f2q9
  tax_year      int not null,
  province      text not null,
  inputs        jsonb not null,        -- raw form inputs (income, RRSP contrib, age, or §7 scenario inputs)
  results       jsonb not null,        -- cached computed outputs
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index idx_scenarios_user on scenarios (user_id);

create table insight_responses (
  id            uuid primary key default gen_random_uuid(),
  scenario_id   uuid references scenarios(id),
  question_key  text not null,         -- e.g. 'has_kids', 'saving_for_home', 'age_65_plus'
  answer        jsonb not null,
  created_at    timestamptz default now()
);

-- ── Optional: DB-driven tax & scenario-planner data (alternative to static files in §9) ──

create table tax_years (
  id            serial primary key,
  year          int unique not null,
  is_current    boolean not null default false,
  indexation_pct numeric(5,2),        -- e.g. 2.00 for the 2% 2026 indexation
  notes         text,
  published_at  timestamptz default now()
);

create table tax_brackets (
  id            serial primary key,
  tax_year_id   int not null references tax_years(id),
  jurisdiction  text not null,        -- 'federal' | 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'NT' | 'NU' | 'ON' | 'PE' | 'QC' | 'SK' | 'YT'
  bracket_order int not null,         -- 1, 2, 3... lowest to highest
  min_income    numeric(12,2) not null,
  max_income    numeric(12,2),        -- null = no upper bound (top bracket)
  rate          numeric(6,4) not null -- e.g. 0.1400 for 14%
);
create index idx_tax_brackets_lookup on tax_brackets (tax_year_id, jurisdiction);

create table tax_constants (
  id            serial primary key,
  tax_year_id   int not null references tax_years(id),
  jurisdiction  text not null,        -- 'federal' | province code | 'n/a' for CPP/EI etc.
  key           text not null,        -- 'basic_personal_amount' | 'cpp_rate' | 'cpp_max_pensionable' |
                                       -- 'ei_rate' | 'ei_max_insurable' | 'tfsa_limit' |
                                       -- 'rrsp_dollar_limit' | 'fhsa_annual_limit' | 'fhsa_lifetime_limit' |
                                       -- 'resp_lifetime_limit' | 'cesg_rate' | 'cesg_annual_max' |
                                       -- 'default_return_rate' | 'rent_affordability_pct' | 'land_transfer_tax_rate' | ...
  value         numeric(14,4) not null,
  unit          text                  -- 'dollars' | 'percent' | 'ratio'
);
create index idx_tax_constants_lookup on tax_constants (tax_year_id, jurisdiction, key);

-- Optional: only add if you want non-engineers to edit insight copy/logic without a deploy
create table insight_rules (
  id            serial primary key,
  rule_key      text unique not null,
  condition     jsonb not null,        -- simple structured condition, e.g. {"has_kids": true, "has_resp": false}
  title         text not null,
  body_template text not null,         -- supports {{variables}} filled from the scenario's inputs/results
  active        boolean not null default true,
  priority      int not null default 0
);
```

**Notes:**
- `scenarios.user_id` is nullable so this table can support pure anonymous share-links without ever requiring accounts.
- `results` is stored as a cache (computed at save time) purely so a saved/shared scenario renders instantly without recomputation — the source of truth for *new* calculations is always the live client-side engine in §5.3/§7, not this table.
- None of this ships in v1. Adopt it only if a specific, deliberate need shows up later (admin-managed rates, or a Flinks-style account-linking feature per §10).

---

## 12. Recommended Tech Stack

Optimized for: cheap to run, fast to build, slick by default, easy for one person to maintain. (Vercel/Next.js is independently validated by the howmuch.tax audit in §2.)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15** (App Router) + **React 19** + **TypeScript** | Industry standard, great DX, static export possible for near-zero hosting cost |
| Styling | **Tailwind CSS v4** + **shadcn/ui** | Fast to build clean, consistent UI; easy to theme once design.md is ready |
| Animation | **Framer Motion** | Smooth number counters, transitions — cheap way to look "slick" |
| Charts | **Recharts** or **visx** | Bracket breakdown (§5), compound-growth and contribution-vs-growth charts (§7) — same library covers both, no extra dependency |
| State | React state / URL query params for the calculator itself | Simplicity; also makes results shareable via URL, same pattern seen on howmuch.tax |
| Backend/DB | **None for v1** (schema ready in §11 for if that ever changes) | All calc is client-side; no accounts = no database needed = $0 backend cost |
| Analytics | **Vercel Analytics** or **Plausible** (privacy-friendly) | Understand usage without invasive tracking |
| Testing | **Vitest** for calculation logic (this is the part that MUST be correct) | Unit-test every bracket/edge case against known CRA examples, plus the compound-interest and affordability formulas in §7 |
| Tax data | **`@equisoft/tax-ca@~2026.10.0`** (LGPL-3.0, 0 deps, see §10.1) | Upstream brackets/CPP/EI/QPIP/OAS + grants, consumed only via `lib/tax-engine/` wrapper; verify bundle size via bundlephobia |

This stack keeps you at effectively $0/month until traffic is meaningful, with a clean upgrade path (add Postgres via Supabase later only if a specific feature — like Flinks account-linking, §10 — actually calls for it).

---

## 13. Non-Functional Requirements

- **Performance:** calculation + re-render should feel instant (<50ms) — it's a pure function, this should be trivial.
- **Privacy:** no PII collected, no income data transmitted or stored server-side. The only server-side data at all is the optional anonymous feedback widget (§8) — no accounts, no user data store. State this plainly in the UI.
- **Accessibility:** proper form labels, keyboard navigation, sufficient color contrast (WCAG AA) — especially since financial tools skew toward being trusted, and trust correlates with polish/accessibility.
- **Correctness:** tax calc logic needs a real test suite against CRA's published examples before launch. The same bar applies to the Scenario Planner's compound-interest and affordability math (§7) — it's simpler math than tax brackets, but it's still the thing people will act on financially, so it needs the same test discipline.
- **Cost ceiling:** target $0–20/month infra at MVP traffic.

---

## 14. Roadmap

**Phase 1 — MVP (Canada, tax calculator only)**
- Federal + all provincial/territorial brackets, single income input, live results, bracket visualization, mobile/tablet responsive.
- Anonymous feedback widget (§8).
- Ship with design.md applied.

**Phase 2 — Financial Insights + Scenario Planner**
- Questionnaire flow (RESP, FHSA, TFSA, RRSP room) with quantified, income-aware insight cards (§6).
- Investment Scenario (§7.1): monthly amount → recommended account priority → compound-growth chart.
- Big-Purchase Budgeting (§7.2): down-payment savings target and rent-affordability check.
- Province comparison view.
- Optional: Statistics Canada income-benchmark insight (§10).

**Phase 3 — Depth (optional, evaluate based on usage)**
- Land transfer tax by province, added to §7.2's home-buying output.
- Paycheck/pay-period calculator (biweekly/monthly breakdown with CPP/EI max-out mid-year).
- Self-employment / CPP2 handling.
- Admin panel for tax-rate data using the optional tables in §11.
- Only if there's real, demonstrated demand: shareable/savable scenarios (§11 schema) — still without requiring full accounts, unless Flinks-style account-linking (§10) is deliberately pursued as its own feature.

**Phase 4 — Expansion (explicitly out of scope until Phase 1–3 are solid)**
- Other countries.

---

## 15. Legal / Trust Note

**Disclaimer — use this exact wording, on every page (global footer):**

> For informational purposes only.
> Numbers are estimates and may not reflect actual tax liabilities.

This matches the pattern confirmed directly on howmuch.tax's own footer (§2). Because it needs to appear on *every* page, build it as a shared layout component rather than something repeated per-page — one source of truth if the wording ever changes. The same disclaimer principle extends naturally to §7's projections: return-rate assumptions and affordability guidelines should be visibly labeled as estimates, not guarantees, right next to the chart.

**Accuracy commitment:** since numbers are the whole product, a visible "data last verified [date], for the 2026 tax year" note alongside the disclaimer builds trust and covers you if CRA revises something mid-year.

---

## 16. Confirmed Decisions

- **No accounts/login in v1** — confirmed. An earlier draft of this PRD mistakenly added a full accounts feature — that's been removed. The calculator, insights, and scenario planner all work fully anonymously; §11 keeps a ready-to-go schema on the shelf in case a specific future feature (like Flinks account-linking, §10) ever needs it, but nothing is stored server-side in v1.
- **"CELIAPP" = FHSA** — confirmed. The Financial Insights content in §6 and the Scenario Planner in §7 both refer to the FHSA (First Home Savings Account) accordingly.
- **All 13 provinces/territories in scope for Phase 1** — confirmed. §5.1 and §9 treat this as the v1 default, not a phased rollout by province.
- **Wait on `design.md` before starting UI build** — confirmed. Calculator and Scenario Planner logic (§5, §7, §9) can be built and unit-tested in parallel in the meantime.
- **Adopt `@equisoft/tax-ca` as upstream tax data + calc library (Sept 3, 2026)** — confirmed. Consumed only through `lib/tax-engine/` wrapper pinned to minor; own Vitest suite vs CRA examples remains source of trust; fallback is vendoring the year's tables if upstream lags in January. See §10.1.

---

## 17. Next Steps

1. You send over `design.md`.
2. I scaffold the Next.js project + tax calculation engine + test suite first (the part that must be correct), before touching UI polish.
3. Build calculator UI against design system.
4. Build insights questionnaire + rules engine (§6).
5. Build Scenario Planner: investment recommendation logic + compound-growth chart, then big-purchase budgeting (§7).
6. QA pass against CRA published examples and the compound-interest/affordability formulas, then launch.
