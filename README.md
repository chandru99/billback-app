# BillBack AI — Payment Integrity Platform

AI-powered medical billing audit and dispute recovery for self-insured employers.

---

## What It Does

BillBack AI ingests a medical bill (PDF, image, or CSV), runs it through an AI audit pipeline, scores each claim for dispute viability, and drafts formal dispute letters — all in one workflow.

**Core workflow:**
1. Upload a bill → Claude parses it into structured claim records
2. Each claim is classified for billing errors (upcoding, duplicate, unbundling, fee-schedule violation)
3. The RPS engine scores every flagged claim for recovery probability
4. The Claim Audit page lets you review every claim with full rationale
5. Select claims and generate a professionally formatted dispute letter

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| AI — Bill parsing | Claude API (`claude-opus-4-5`) |
| AI — Dispute letters | Claude API (`claude-opus-4-5`) |
| RPS scoring | Custom logistic regression engine (see below) |
| Storage | Session storage (no database — demo speed) |

---

## The RPS Scoring Model

**RPS (Recovery Probability Score)** is a purpose-built logistic regression engine, not a general LLM. It lives in `lib/rps.ts` and runs entirely client-side at zero API cost.

### Training Data

The model uses **400 synthetic historical billing dispute records** hand-crafted in `lib/synthetic-training-data.ts`, distributed evenly across 4 error classes:

| Error Class | Total Records | Train | Test | Approx. Win Rate | Notes |
|---|---|---|---|---|---|
| Duplicate Charge | 100 | 80 | 20 | ~92% | Exact CPT + date + provider matches — clearest cases |
| Fee Schedule Violation | 100 | 80 | 20 | ~88% | In-network providers bound by contract |
| Upcoding | 100 | 80 | 20 | ~74% | Requires chart review; provider can argue documentation |
| Unbundling | 100 | 80 | 20 | ~61% | Most contested — providers often claim modifier exceptions |

**Train / test split:** 80/20 per class (320 training, 80 test). The first 80 records of each class train the model; the last 20 are held out for evaluation. Model statistics are built exclusively from training records — the test set is never seen during scoring. Call `evaluateModel()` in `lib/rps.ts` to run accuracy, precision, recall, and F1 against the held-out test set.

Each record contains:
- `errorClass` — type of billing error
- `overchargeRatio` — overcharge as a fraction of billed amount
- `billedToAllowableRatio` — markup multiple
- `overchargeAmount` — absolute dollar overcharge
- `hasGuidelineCitation` — whether an NCCI edit, AMA CPT rule, or Fair Health benchmark supports the dispute
- `providerInNetwork` — whether the provider has a contracted rate
- `disputeWon` — outcome label

> **Why synthetic data?** Real billing dispute outcomes are protected health information (PHI) under HIPAA. The synthetic records were constructed to reflect documented win-rate patterns from published medical billing audit literature and CMS appeals data.

### How the Model Works

```
Bill claim  →  Feature extraction  →  Logistic regression  →  RPS score (0–100)
```

**Step 1 — Class statistics:** At startup, the engine computes win rates, average overcharge ratios, and guideline/network split rates from the 320 training records, per error class.

**Step 2 — Feature extraction (`extractFeatures`):**
- Overcharge ratio and billed/allowable ratio from claim numbers
- Guideline citation presence inferred from audit detail text (NCCI, AMA, Fair Health keywords)
- In-network status inferred from error class and detail text

**Step 3 — Logistic regression adjustment:**
```
log_odds = logit(class_base_rate)
         + 1.8 × (overcharge_ratio_delta)
         + 0.9 × (billed_ratio_delta)
         + 0.7 × (guideline_citation_adjustment)
         + 0.5 × (network_adjustment)
         + 0.4 × (log_dollar_amount_signal)

probability = sigmoid(log_odds)
```
Weights reflect domain knowledge: overcharge magnitude is the strongest predictor, guideline citations add a discrete boost, and in-network status strengthens contractual enforcement cases.

**Step 4 — Confidence score:** Penalised when the claim's features are far from the training distribution (out-of-distribution detection) or when the error class has fewer training examples.

**Step 5 — Rationale:** A plain-English explanation of every factor that drove the score, shown in the Claim Audit page.

**Rule-based duplicate check:** Independent of Claude's classification, the engine also cross-checks for the same CPT code billed twice on the same date by the same provider. If found, it boosts that claim's confidence score.

### RPS Classification

| Score | Class | Meaning |
|---|---|---|
| ≥ 75% | High (green) | Strong case — file immediately |
| 45–74% | Medium (yellow) | Worth filing with documentation |
| < 45% | Low (red) | Human review recommended first |

---

## Features

- **Bill upload** — PDF, image, or CSV; Claude extracts all line items, error types, and coding context
- **Error detection** — upcoding, duplicate charges, unbundling, fee schedule violations
- **RPS scoring** — per-claim probability score with full rationale and confidence rating
- **Claim Audit page** — review every claim (flagged and clean), filter, sort, search, expand for full detail
- **Multi-claim dispute letters** — select any combination of flagged claims; one structured letter covers all of them with numbered sections per line item
- **Professional letter format** — fixed template rendered as a paper document with a BillBack stamp; Claude returns structured JSON so the layout never changes
- **Demo accounts** — three preloaded employer cases (Meridian Corp, Pinnacle Industries, Coastal Health Systems)

---

## Project Structure

```
billback-app/
├── app/
│   ├── page.tsx                       # Upload + employer select
│   ├── dashboard/page.tsx             # KPI overview, claims table, RPS panel
│   ├── claim-audit/page.tsx           # Per-claim audit detail, RPS rationale
│   ├── dispute/page.tsx               # Multi-claim dispute letter generator
│   └── api/
│       ├── parse-bill/route.ts        # PDF/CSV → structured claim data (Claude)
│       ├── generate-dispute/route.ts  # Selected claims → dispute letter (Claude)
│       └── employers/route.ts         # Demo employer list
├── components/
│   ├── Sidebar.tsx
│   ├── Topbar.tsx
│   ├── KPICards.tsx
│   ├── ClaimsTable.tsx
│   ├── RPSPanel.tsx
│   └── ActivityFeed.tsx
└── lib/
    ├── types.ts                       # TypeScript interfaces
    ├── rps.ts                         # RPS scoring engine (logistic regression)
    ├── synthetic-training-data.ts     # 400-record dataset with 80/20 train/test split
    ├── claude.ts                      # Anthropic API client + prompts
    └── demo-data.ts                   # Three preloaded employer demo cases
```

---

## Setup

### 1. Clone and install

```bash
git clone <your-repo>
cd billback-app
npm install
```

### 2. Add your Anthropic API key

```bash
cp .env.local.example .env.local
# Edit .env.local and paste your key
ANTHROPIC_API_KEY=your_key_here
```

Get a key at: https://console.anthropic.com

### 3. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

---

## Deployment (Vercel)

```bash
npm install -g vercel
vercel
# Add environment variable: ANTHROPIC_API_KEY = your_key_here
```

Or push to GitHub and connect to Vercel for automatic deploys.

---

## Demo Flow

1. Open `localhost:3000`
2. Select **Meridian Corp** (the $9,630 overcharge case) and click the demo button
3. **Dashboard** — review KPI cards, weighted RPS gauge, and claims table
4. **Claim Audit** — click any claim to expand full RPS rationale and billing breakdown
5. **Disputes** — select claims with checkboxes, hover for dispute reason, click Generate
6. Download or copy the formatted dispute letter

For a live AI demo: upload `BillBack_Sample_Bill.docx` as a PDF — Claude parses it, detects the errors, and scores RPS in real time.

---

## Revenue Model

- **$3 PEPM** platform access fee per covered employee per month
- **20% contingency** on recovered overcharge amounts
- Zero upfront cost to the employer

---

## Context — Chandra, 30th March 2026

Full record of product and engineering work completed in this session.

### 1. Branding — "Claude" → "Billback"
Replaced all user-facing references to "Claude is generating" with "Billback is generating" across the dispute letter UI. The underlying model remains Claude (`claude-opus-4-5`) but the product identity is Billback AI.

**Files changed:** `app/dispute/page.tsx`

---

### 2. Dispute Page — Multi-Select + Hover Tooltip
Replaced the single-click auto-generate flow with a deliberate selection + generate pattern:

- Each flagged claim now has a **checkbox** (teal when selected)
- **Hover tooltip** floats to the right of each claim card showing the AI's dispute reason (`claim.details`)
- **Select All / Deselect All** toggle in the panel header
- A **summary card** at the bottom shows selected count and total disputed amount
- A single **"Generate Dispute Letter (N)"** button triggers one letter covering all selected claims
- All flagged claims are pre-selected on page load

**Files changed:** `app/dispute/page.tsx`

---

### 3. Professional Dispute Letter Format
Replaced the plain-text `<pre>` typewriter render with a fixed, professional letter template:

- Claude now returns **structured JSON** (`recipientBlock`, `subject`, `salutation`, `paragraphs[]`, `signature`, `cc`) instead of free-form text — guaranteeing the layout never varies between runs
- Letter renders as a **white paper document** on a grey desk background with serif typography, justified body text, and proper letter spacing
- **BillBack AI Verified stamp** in the top-right corner of every letter
- Copy and Download reconstruct plain text from the structured fields
- Removed typewriter effect; replaced with a smooth fade-in

**Files changed:** `app/dispute/page.tsx`, `app/api/generate-dispute/route.ts`, `lib/claude.ts`, `lib/types.ts`

---

### 4. Claim Audit Page (new)
Built the `/claim-audit` page that was previously a placeholder routing back to the dashboard.

**Features:**
- Shows **all claims** (flagged and clean) with filter tabs: All / Flagged / Clean
- **Sort** by overcharge amount, RPS score, billed amount, or CPT code
- **Search** by CPT, description, or error type
- **Expandable claim rows** — clicking any claim reveals: provider, date, ICD-10, billing breakdown, audit finding, and the full RPS engine rationale
- Summary KPI strip: total claims audited, flagged count, total overcharge, weighted RPS
- Flagged claims have a "Generate Dispute Letter" button routing directly to the dispute page
- Sidebar badge count now links to `/claim-audit` instead of `/dashboard`

**Files changed:** `app/claim-audit/page.tsx` (new), `components/Sidebar.tsx`

---

### 5. RPS Training Dataset — 160 → 400 Records
Expanded the synthetic training dataset from 160 to 400 records (100 per error class):

| Class | Before | After |
|---|---|---|
| Duplicate Charge | 40 | 100 |
| Fee Schedule Violation | 40 | 100 |
| Upcoding | 40 | 100 |
| Unbundling | 40 | 100 |

New records maintain realistic win-rate distributions and vary amount size, network status, and guideline citation presence.

**Files changed:** `lib/synthetic-training-data.ts`

---

### 6. Train / Test Split + Model Evaluation (internal)
Added a proper 80/20 train/test split and a model evaluation function for internal use. **Not exposed in the UI** — for engineering/research purposes only.

- `getTrainTestSplit()` in `synthetic-training-data.ts` returns first 80 of each class as training, last 20 as test (320 train / 80 test total)
- `CLASS_STATS` in `rps.ts` is now built exclusively from training records — the test set is never seen during scoring
- `evaluateModel()` in `rps.ts` scores all 80 test records using ground-truth features and returns overall accuracy, precision, recall, F1, and per-class confusion matrices
- This function is available for internal benchmarking; it is not rendered anywhere in the product

**Files changed:** `lib/synthetic-training-data.ts`, `lib/rps.ts`

---

### 7. Manual Claim Addition in Dispute Page
Users can now dispute any line item on the bill — not just the ones the AI flagged.

- Left panel split into two sections: **AI Flagged** (existing flow) and **Add Other Claims** (collapsed by default)
- Expanding "Add Other Claims" shows all non-flagged line items
- Checking a non-flagged claim reveals a **required reason textarea** — the user must describe why they are disputing the charge
- Card border turns yellow if checked without a reason; teal once a reason is entered
- Generate button is disabled until all manually-added claims have a reason
- The user's reason is merged into the claim's `details` field before the API call
- In `lib/claude.ts`, `errorClass: 'none'` claims use `details` as the dispute basis, prompting the letter to quote the user's reason and request itemized documentation

**Files changed:** `app/dispute/page.tsx`, `lib/claude.ts`

---

### 8. README Updates
- Resolved git merge conflict in `README.md`
- Corrected dataset size (was incorrectly stated as 160/40-per-class; now accurately documents 400/100-per-class)
- Added train/test split documentation and `evaluateModel()` reference
- Added Claim Audit page to project structure
- Updated Step 1 class statistics description to reference 320 training records

---

---

## Context — Chandra, 30th March 2026 (Version 3)

### 10. Two-Pass AI Pipeline (Non-Determinism Fix)

**Problem:** Different users uploading the same bill received different error classifications and different weighted RPS scores. Root cause: a single-pass prompt asked Claude to simultaneously read the raw document AND apply medical billing knowledge to classify errors — two distinct tasks that compounded each other's variance.

**Solution:** Refactored `lib/claude.ts` into a two-pass architecture that separates extraction from classification.

**Pass 1 — Extract (`runPass1Image` / `runPass1Text`)**
- Input: raw document (image bytes or plain text)
- Output: `RawBillExtraction` — structured JSON of line items exactly as they appear on the bill (CPT, description, provider, date, billed amount, ICD-10, units)
- No error classification whatsoever — pure transcription
- Near-deterministic at `temperature: 0` because it is only reading numbers and text already on the page

**Pass 2 — Classify (`runPass2`)**
- Input: `RawBillExtraction` JSON from Pass 1 (structured text — no image, cheap)
- Output: `ClassifiedLineItem[]` — one classification per line item
- Applies NCCI edits, AMA E/M guidelines, commercial rate benchmarks
- Explicit decision rules in the system prompt eliminate the most common borderline cases:
  - Same CPT + same date + same provider → always `duplicate`, never `upcoding`
  - Billed > 150% commercial rate + in-network → always `fee-schedule`, not `upcoding`
  - `upcoding` reserved exclusively for E/M code complexity disputes

**Key benefits:**
- Pass 1 variance (misreading numbers) and Pass 2 variance (misclassifying errors) are now independent and measurable
- Re-classify with an updated prompt without re-parsing the document
- Enables per-CPT caching in future (cache key = `hash(cpt + billed + provider + date)`)
- Rule-based duplicate detection can pre-empt the AI call entirely for that error class

**New types added to `lib/types.ts`:** `RawLineItem`, `RawBillExtraction`, `ClassifiedLineItem`

**Files changed:** `lib/claude.ts`, `lib/types.ts`

---

### 11. Staged Upload — Parse & Audit Bill Button

Previously, dropping or selecting a file immediately triggered the API call with no user confirmation. Now the upload flow has an explicit staging step:

1. User drops or selects a file → file is **staged** (stored in state, nothing sent to API)
2. A confirmation card appears showing the filename, file size, and a **"Parse & Audit Bill"** button
3. User clicks the button → two-pass pipeline starts
4. While processing, a two-step progress indicator shows:
   - **Pass 1** dot active: "Extracting line items... Reading CPT codes, amounts, and providers from your document"
   - **Pass 2** dot active: "Classifying billing errors... Applying NCCI edits, AMA guidelines, and commercial rate benchmarks"
5. A "Remove" link lets the user clear the staged file and start over

The demo button flow is unchanged.

**Files changed:** `app/page.tsx`

---

### 12. Architecture Document

Added `ARCHITECTURE.md` at the project root with:
- Full end-to-end request flow diagram (ASCII)
- Two-pass pipeline design rationale and comparison to the single-pass approach
- RPS scoring engine internals (logistic regression formula, training data summary)
- Complete data flow with TypeScript type chain
- Pages and components reference
- Key design decisions table with rationale
- External dependencies table

**Files changed:** `ARCHITECTURE.md` (new)

---

### 9. Mobile Responsiveness
Made the entire app responsive for mobile screens while leaving the desktop layout completely undisturbed. All mobile rules use Tailwind `md:` breakpoints as overrides so the desktop experience is pixel-identical to before.

**Changes per file:**

- **`components/Sidebar.tsx`** — Sidebar hidden on mobile (`hidden md:flex`). A fixed bottom navigation bar (`flex md:hidden`) replaces it with four icon+label tabs: Dashboard, Audit, Disputes, New Bill. Active route is highlighted in teal.

- **`components/Topbar.tsx`** — Breadcrumb and Q1 period pill hidden on mobile. Case ID truncated. Buttons condensed (icon-only Copy/Download on small screens).

- **`components/ClaimsTable.tsx`** — On mobile, the data table is replaced with a compact **card view** (`block sm:hidden`) showing CPT, description, overcharge, error badge, RPS badge, and a Dispute button per row. Desktop table (`hidden sm:block`) is unchanged.

- **`components/KPICards.tsx`** — Already rendered in a `grid-cols-2` layout on mobile; no changes needed.

- **`app/dashboard/page.tsx`** — Main padding reduced (`p-4 md:p-6`) and bottom padding added (`pb-20 md:pb-6`) to prevent content from hiding behind the mobile bottom nav.

- **`app/claim-audit/page.tsx`** — Header condensed on mobile (back arrow only, patient info line hidden). Padding adjusted for bottom nav.

- **`app/dispute/page.tsx`** — On mobile, a **tab bar** at the top switches between "Select Claims" and "Generate / View Letter" panels (stacked, full-width). On desktop the original side-by-side layout is preserved. Hover tooltip hidden on mobile (touch devices cannot hover). `DisputeLetter` component padding reduced on mobile (`px-6 py-8 md:px-14 md:py-12`).

- **`app/page.tsx`** — Landing page was already responsive (marketing panel uses `hidden lg:flex`); no changes needed.
