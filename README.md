# Canadian Income Tax Calculator & Financial Insights

> Free, fast, mobile-friendly, Canada-first tax calculator with personalized insights and scenario planning. No accounts. No tracking of income data. Everything runs client-side.

**Status:** Draft v1 for planning — see [`PRD-canada-tax-calculator.md`](./PRD-canada-tax-calculator.md)
**Design System:** [`DESIGN.md`](./DESIGN.md)
**Last updated:** September 2026

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Data Architecture](#data-architecture)
- [Testing](#testing)
- [Roadmap](#roadmap)
- [Privacy](#privacy)
- [Legal Disclaimer](#legal-disclaimer)
- [Contributing](#contributing)

---

## Overview

Three things in one app:

1. **Tax Calculator** — enter income + province, instantly see federal + provincial tax, CPP/QPP, EI, take-home pay, marginal vs. average rate, and visual bracket breakdown. Inspired by howmuch.tax, but Canada-first.
2. **Financial Insights** — short rules-based questionnaire (5–8 questions) surfacing registered-account opportunities (RESP, FHSA, TFSA, RRSP) quantified with the user's actual numbers.
3. **Scenario Planner** — model two decisions with after-tax income: *can I invest, and where?* (compound-growth chart) and *how much to save for a home?* (down-payment target or 30%-of-net rent check).

Canada only for v1. No login, nothing saved server-side. Results shareable via URL.

Non-goals for v1: no business/T2 tax, no capital-gains optimizer, no US/other countries, no live housing data, no full budgeting engine.

---

## Features

### 1. Tax Calculator

**Inputs:** province/territory (all 13), employment income (required), self-employment / other income / RRSP contributions / tax year / age (optional, under "add more detail").

**Outputs:**

- Total tax (federal + provincial), CPP/QPP, EI
- Net income — annual, monthly, biweekly
- Marginal vs. average (effective) rate
- Stacked bracket breakdown chart
- Province comparison ("what if you lived in Alberta?")

### 2. Financial Insights Engine

Runs after calculation. Decision table, not AI — every card traceable to one sentence.

| Condition | Example Insight |
|---|---|
| Kids < 18, no RESP | $2,500/yr unlocks $500/yr CESG grant |
| Saving for first home | FHSA $8,000/yr deduction + tax-free withdrawal, saves ~$Y at X% marginal |
| Income entered, no RRSP | Contributing $X drops bracket Y% → Z%, saves ~$W |
| Any | TFSA vs RRSP tradeoff by actual marginal rate |
| Age 65+ | Age credit, pension splitting, OAS clawback |

Insight cards deep-link into the Scenario Planner, pre-filled.

### 3. Scenario Planner

Same UX pattern as calculator: few inputs, live result, one chart.

- **Investment:** net income (auto-filled) + $/mo + goal + horizon + expected return → priority waterfall (FHSA → RRSP/TFSA by marginal rate) → Recharts stacked area (contributions vs growth, optional RRSP-refund-reinvested line).
- **Home:** target price + down % (5/10/20/custom) + timeframe → $/mo needed + HBP/FHSA note. **Rent:** 30%-of-net guideline, labeled as rule of thumb.
- **Feedback widget:** anonymous thumbs up/down + optional comment (single Supabase table, fingerprint-keyed, no login).

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript | RSC prefetch = instant nav, static export = ~$0 hosting |
| Styling | Tailwind CSS v4 + shadcn/ui | Theme from `DESIGN.md` |
| Animation | Framer Motion | Number count-ups, transitions |
| Charts | Recharts | Bracket + growth charts, one lib |
| State | React state + URL query params | Shareable results, no backend |
| Backend/DB | None for v1 | All calc client-side |
| Analytics | Vercel Analytics or Plausible | Privacy-friendly, ad-block resilient |
| Testing | Vitest | Bracket/edge-case correctness |

Design tokens, breakpoints (`<640px`, `640–1024px`, `>1024px`), and components defined in [`DESIGN.md`](./DESIGN.md).

---

## Getting Started

### Prerequisites

- Node.js 20+ (LTS recommended)
- npm / pnpm / yarn

### Install & Run

```bash
# clone
git clone <repo-url>
cd CDL-pool

# install
npm install

# dev
npm run dev

# build
npm run build

# test (calc engine — must stay green)
npm run test
```

App runs at `http://localhost:3000` after scaffold (Phase 1).

> Note: repo is currently docs-only (`PRD` + `DESIGN`). Scaffold (Next.js + engine + tests) is the next step per Roadmap.

---

## Project Structure

Planned layout (to be scaffolded):

```
app/
  layout.tsx              # global layout + disclaimer footer
  page.tsx                # calculator-first hero
  insights/               # questionnaire + insight cards
  planner/                # investment + home/rent scenarios
components/
  calculator/             # inputs, results, bracket-chart
  insights/               # question flow, insight-card
  planner/                # growth-chart, savings-target
  ui/                     # shadcn/ui primitives
  feedback-widget.tsx
  disclaimer-footer.tsx
lib/
  tax-engine/             # pure functions: federal, provincial, cpp/ei, credits
  insights-engine/        # rules table
  planner-engine/         # FV formula, affordability
data/
  tax-tables/
    2026.ts               # federal + 13 provincial brackets, BPA, CPP/EI, limits
    2025.ts
  assumptions.ts          # default return, 30% rent, down-payment presets
tests/
  tax-engine.test.ts
  planner-engine.test.ts
docs/
  data-sources.md         # CRA page + pull date per number
```

---

## Data Architecture

- All tax-year data (brackets, BPA, CPP/EI rates/max, TFSA/RRSP/FHSA/RESP limits) lives in versioned, typed config — never inline in logic.
- Engine signature: `calculate(income, province, taxYear)` → table lookup.
- Scenario assumptions (return rate, rent %, down presets) use the same versioned pattern.
- Reference figures for 2026 (verify at build + every January): Federal 14% to $58,523 → 33% over $258,482; BPA $16,452; TFSA $7,000; RRSP $33,810; FHSA $8k/yr $40k lifetime; RESP $50k + CESG 20% to $500/yr; HBP $60k/15yr.
- CRA publishes static pages/PDFs — no official API. Third-party APIs (API Ninjas, CountryTaxCalc) used only as test cross-checks, not source of truth.
- Optional Postgres schema for future DB-driven rates / saved scenarios is documented in PRD §11 — not required for v1.

---

## Testing

Correctness is the product:

```bash
npm run test
```

- Unit-test every bracket/edge case against CRA published examples.
- Same bar for FV compound-interest and affordability math.
- Keep `docs/data-sources.md` updated (source URL + date pulled) so January updates are ~30 min.

---

## Roadmap

- **Phase 1 — MVP:** federal + all 13 provinces, single income input, live results, bracket viz, responsive, feedback widget, design applied.
- **Phase 2 — Insights + Planner:** questionnaire, quantified cards, investment waterfall + growth chart, down-payment + rent check, province compare, optional StatCan median benchmark.
- **Phase 3 — Depth (if usage warrants):** land transfer tax, paycheck view, self-employment/CPP2, shareable scenarios, admin panel for rates.
- **Phase 4 — Expansion:** other countries. Explicitly out of scope until 1–3 are solid.

Next steps: 1) scaffold Next.js + engine + tests, 2) calculator UI, 3) insights engine, 4) planner, 5) QA vs CRA examples, launch.

---

## Privacy

No PII collected. No income data transmitted or stored server-side. Calculations run 100% in-browser. Only server-side data is the optional anonymous feedback vote + comment.

---

## Legal Disclaimer

Rendered in global footer on every page:

> For informational purposes only.
> Numbers are estimates and may not reflect actual tax liabilities.

Plus visible `data last verified [date], for the 2026 tax year` note. Return-rate and affordability outputs labeled as estimates, not guarantees.

---

## Contributing

1. Tax data changes yearly — update `data/tax-tables/<year>.ts` + `docs/data-sources.md`, add tests, never hardcode rates in components.
2. Insight rules must stay explainable in one sentence.
3. Run `npm run test` before any PR touching `lib/tax-engine` or `lib/planner-engine`.
