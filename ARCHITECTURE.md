# BillBack AI — System Architecture

**Version 3 · Updated 30th March 2026**

---

## Overview

BillBack AI is a Next.js 14 App Router application that audits medical bills for self-insured employers. A bill upload triggers a two-pass AI pipeline that extracts line items and classifies billing errors independently, then feeds the classified claims into a deterministic RPS scoring engine before surfacing results across three pages: Dashboard, Claim Audit, and Dispute Letter Generator.

---

## End-to-End Request Flow

```
User uploads bill (PDF / image / CSV)
        │
        ▼
[ app/page.tsx ]
  Stage file → show "Parse & Audit Bill" button
  User clicks button → POST /api/parse-bill
        │
        ▼
[ app/api/parse-bill/route.ts ]
  Route handler — validates input, calls lib/claude.ts
        │
        ├─── type: image/pdf  ──► parseBillFromBase64()
        ├─── type: text/csv   ──► parseBillFromText()
        └─── type: demo       ──► DEMO_CASES[employerId]
        │
        ▼
[ lib/claude.ts  ——  TWO-PASS PIPELINE ]
  │
  ├─ PASS 1: runPass1Image() / runPass1Text()
  │    Model:  claude-opus-4-5  |  temp: 0  |  max_tokens: 2000
  │    Input:  raw document (image bytes or text)
  │    Output: RawBillExtraction { patientName, facility, lineItems[] }
  │            Each lineItem: { cpt, desc, provider, date, billed, icd10?, units? }
  │    Purpose: pure transcription — no judgement, no classification
  │
  └─ PASS 2: runPass2()
       Model:  claude-opus-4-5  |  temp: 0  |  max_tokens: 3000
       Input:  RawBillExtraction JSON (structured — no image)
       Output: ClassifiedLineItem[] — one object per line item, same order
               Each item: { cpt, error, errorClass, allowable, overcharge,
                            details, letterContext, claudeConfidence, ambiguous }
       Purpose: apply NCCI edits, AMA E/M guidelines, commercial rate benchmarks
        │
        ▼
[ lib/claude.ts — buildCaseData() ]
  Merge Pass 1 + Pass 2 → raw Claim[]
  Feed into applyRPSScoring() ──► scored Claim[]
  Compute computeWeightedRPS() ──► weightedRPS number
  Return CaseData object
        │
        ▼
[ API route returns CaseData ]
        │
        ▼
[ app/page.tsx ]
  sessionStorage.setItem('billback_case', JSON.stringify(data))
  router.push('/dashboard')
        │
        ▼
[ app/dashboard/page.tsx ]
  Reads CaseData from sessionStorage
  Renders: KPICards · ClaimsTable · RPSPanel · ActivityFeed
```

---

## Two-Pass Pipeline — Design Rationale

### Why two passes instead of one?

A single-pass prompt asks Claude to simultaneously read a raw document AND apply complex medical billing knowledge to classify each line. These are cognitively distinct tasks, and combining them introduces two independent sources of variance:

1. **Document reading variance** — misreading a number or CPT code
2. **Classification variance** — applying different billing rules to the same facts

Separating the passes isolates each source:

```
Single pass (v1/v2):
  Document ──► [Extract + Classify simultaneously] ──► CaseData
  Variance source: reading errors AND classification errors combined — hard to detect

Two-pass (v3):
  Document ──► [Pass 1: Extract only] ──► RawBillExtraction  (near-deterministic)
               RawBillExtraction ──► [Pass 2: Classify only] ──► ClassifiedLineItem[]
  Variance source: classification only — measurable and addressable independently
```

### Pass 1 — Extract

- **Input:** Raw document (image bytes via base64, or plain text)
- **Output:** `RawBillExtraction` — structured JSON of line items as they appear on the bill
- **What it does NOT do:** assign error types, compute allowable amounts, flag overcharges
- **Determinism:** Very high. The model is transcribing numbers and text already present on the page. Variance approaches zero at `temperature: 0`.
- **Tokens:** ~2000 max — the output is compact structured data

### Pass 2 — Classify

- **Input:** `RawBillExtraction` JSON (no image — pure text, very cheap)
- **Output:** `ClassifiedLineItem[]` — one classification per line item in the same order
- **What it does:** applies NCCI edits, AMA E/M guidelines, commercial rate benchmarks, duplicate detection rules
- **Determinism:** Higher than single-pass because the input is already structured and consistent. Residual variance is from borderline cases where multiple error types are defensible.
- **Explicit decision rules** in the system prompt reduce ambiguity for the most common borderline cases:
  - Duplicate CPT on same date → always `duplicate`, never `upcoding`
  - Billed > 150% of commercial rate + in-network → always `fee-schedule`, not `upcoding`
  - `upcoding` reserved for E/M code complexity disputes only
- **Tokens:** ~3000 max

### Additional benefits

| Benefit | Description |
|---|---|
| Re-classify without re-parsing | If the classification prompt is updated, Pass 2 can be re-run on the stored `RawBillExtraction` without calling the vision model again |
| Per-CPT caching (future) | Cache key can be `hash(cpt + billed + provider + date)` rather than the entire bill — cache hit rate is much higher |
| Rule-based pre-classification | Exact duplicate detection (same CPT + date + provider) can be handled in code before Pass 2, removing that entire class from AI variance |
| Independent evaluation | Pass 1 accuracy (did it read the numbers correctly?) and Pass 2 accuracy (did it classify correctly?) can be measured separately |

---

## RPS Scoring Engine

The Recovery Probability Score engine lives entirely in `lib/rps.ts` and runs client-side at zero API cost. It is a logistic regression model, not an LLM.

```
ClassifiedLineItem[]
        │
        ▼
[ applyRPSScoring() ]
  For each claim with errorClass ≠ 'none':
    1. extractFeatures(claim)  →  { overchargeRatio, billedRatio, hasGuideline, inNetwork, logDollarAmount }
    2. logit(classBaseRate) + weighted feature adjustments  →  log_odds
    3. sigmoid(log_odds)  →  probability (0–1)
    4. out-of-distribution penalty  →  confidence score
    5. plain-English rationale string
  Return scored Claim[]
        │
        ▼
[ computeWeightedRPS() ]
  Weighted average of per-claim RPS × overcharge amount
  Returns integer 0–100 displayed in dashboard gauge
```

**Training data:** 400 synthetic records (100 per error class: duplicate, fee-schedule, upcoding, unbundling). 80/20 train/test split per class = 320 training records, 80 held-out test records.

**Logistic regression weights:**
```
log_odds = logit(class_base_rate)
         + 1.8 × overcharge_ratio_delta
         + 0.9 × billed_ratio_delta
         + 0.7 × guideline_citation_adjustment
         + 0.5 × network_adjustment
         + 0.4 × log_dollar_amount_signal
```

**Model evaluation:** `evaluateModel()` in `lib/rps.ts` scores all 80 test records and returns accuracy, precision, recall, F1, and per-class confusion matrices. Not rendered in the UI — internal use only.

---

## Data Flow — Types

```
lib/types.ts

RawLineItem                    ← Pass 1 output per line
RawBillExtraction              ← Pass 1 full output (wraps RawLineItem[])
ClassifiedLineItem             ← Pass 2 output per line
Claim                          ← Merged Pass 1 + Pass 2 + RPS scoring
CaseData                       ← Full session object stored in sessionStorage
DisputeLetterData              ← Structured JSON returned by generateDisputeLetter()
```

---

## Pages and Components

```
app/
├── page.tsx                   Upload screen
│                              · Stage file → Parse & Audit Bill button
│                              · Two-pass progress indicator (Extract → Classify)
│                              · Demo employer selector
│
├── dashboard/page.tsx         Post-audit overview
│                              · KPICards (4 metrics with count-up animation)
│                              · ClaimsTable (desktop table / mobile card view)
│                              · RPSPanel (weighted gauge + class breakdown)
│                              · ActivityFeed
│
├── claim-audit/page.tsx       Per-claim detail
│                              · Expandable rows: provider, billing breakdown, audit finding, RPS rationale
│                              · Filter tabs (All / Flagged / Clean)
│                              · Sort (overcharge / RPS / billed / CPT)
│                              · Search
│
├── dispute/page.tsx           Dispute letter generator
│                              · AI Flagged section (checkbox + hover tooltip)
│                              · Add Other Claims section (manual + reason textarea)
│                              · DisputeLetter component (white paper, serif, BillBack stamp)
│                              · Mobile tab layout (Select Claims / View Letter)
│
└── api/
    ├── parse-bill/route.ts    Orchestrates two-pass pipeline via lib/claude.ts
    ├── generate-dispute/      Calls generateDisputeLetter() in lib/claude.ts
    └── employers/             Returns demo employer list

lib/
├── claude.ts                  Two-pass AI pipeline + dispute letter generation
├── rps.ts                     Logistic regression scoring engine
├── synthetic-training-data.ts 400-record training dataset with 80/20 split
├── types.ts                   All TypeScript interfaces
└── demo-data.ts               Three preloaded employer cases
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Two-pass AI pipeline | Isolates extraction variance from classification variance; enables independent re-classification |
| `temperature: 0` on all Claude calls | Minimises output variance; the model still has residual variance at 0 due to floating-point non-determinism in distributed inference |
| Explicit classification decision rules in Pass 2 prompt | Eliminates the most common ambiguous cases (duplicate vs. upcoding, fee-schedule vs. upcoding) before the model reasons about them |
| RPS as logistic regression, not LLM | Fully deterministic; zero API cost; runs client-side; auditable weights |
| Structured JSON letter output | Letter layout is fixed in React; only content varies — guarantees consistent formatting regardless of model output style |
| Session storage, no database | Demo-speed architecture; no auth, no persistence layer; sufficient for POC and early customer demos |
| Staged file + Parse button | User explicitly triggers the API call; avoids accidental uploads and makes the two-pass progress visible |

---

## External Dependencies

| Dependency | Purpose |
|---|---|
| `@anthropic-ai/sdk` | Claude API client (Pass 1, Pass 2, dispute letters) |
| `next` 14 (App Router) | Framework, routing, API routes |
| `tailwindcss` | Utility-first styling |
| `lucide-react` | Icons |
| `uuid` | Claim ID generation |
| `typescript` | Type safety across the pipeline |
