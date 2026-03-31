import Anthropic from '@anthropic-ai/sdk'
import { CaseData, Claim, RawLineItem, RawBillExtraction, ClassifiedLineItem } from './types'
import { applyRPSScoring, computeWeightedRPS } from './rps'
import { v4 as uuid } from 'uuid'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── PASS 1 ─────────────────────────────────────────────────────────────────────
// Pure data extraction — reads the document and returns raw line items only.
// No error classification happens here. This pass is near-deterministic because
// it is purely transcribing numbers, codes, and text already on the page.

const PASS1_SYSTEM = `You are a medical bill data extraction system for BillBack AI.

Your ONLY job is to extract raw line item data exactly as it appears in the document. Do NOT classify errors, flag overcharges, or make any clinical judgement.

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "patientName": "Full Name",
  "dateOfService": "Month DD, YYYY",
  "facility": "Facility or Hospital Name",
  "lineItems": [
    {
      "cpt": "99215",
      "desc": "Exact description of the service as written on the bill",
      "provider": "Provider or physician name",
      "date": "Feb 14, 2024",
      "billed": 425,
      "icd10": "Z00.00",
      "units": 1
    }
  ]
}

RULES:
- Extract every line item on the bill, including lines that appear correct
- billed must be a number (no $ sign, no commas)
- units defaults to 1 if not shown
- icd10 may be omitted if not present on the bill
- Do NOT add errorClass, allowable, overcharge, or any classification field
- Do NOT skip or merge line items — every row on the bill must appear in lineItems
- Return ONLY the JSON object`

// ── PASS 2 ─────────────────────────────────────────────────────────────────────
// Error classification — takes the structured line items from Pass 1 and
// applies medical billing audit rules to each one independently.
// Separating this from extraction means: (a) classification can be re-run
// without re-parsing the document, (b) variance is isolated to this step only.

const PASS2_SYSTEM = `You are a medical billing audit AI for BillBack AI, a payment integrity platform for self-insured employers.

You will receive a JSON array of line items already extracted from a medical bill. Your job is to classify each line item for billing errors.

Error types to detect:
- Upcoding: Code billed at higher complexity/level than clinically documented
- Duplicate Charge: Same CPT code billed more than once on same date by same provider
- Unbundling: Component procedure billed separately when included in a comprehensive code per NCCI edits
- Fee Schedule Violation: Amount billed substantially exceeds commercial market rates
- None: No error detected

Return ONLY a valid JSON array — one object per input line item, in the same order (no markdown, no explanation):
[
  {
    "cpt": "99215",
    "error": "Upcoding",
    "errorClass": "upcoding",
    "allowable": 211,
    "overcharge": 214,
    "details": "Specific explanation citing the guideline or rule violated. Format: [Evidence from bill] → [Guideline violated] → [Why this constitutes an error].",
    "letterContext": "Description of error for use in a formal dispute letter, or null if no error",
    "claudeConfidence": "high",
    "ambiguous": false
  }
]

CRITICAL RULES FOR ALLOWABLE AMOUNTS:
- This platform serves self-insured EMPLOYER plans — never use Medicare/CMS rates
- Use the 80th percentile of COMMERCIAL rates for the geographic region
- For fee schedule violations: allowable = fair commercial market rate
- For upcoding: allowable = commercial rate for the correct lower-level code
- For unbundling: allowable = 0 (component code should not be billed at all)
- For duplicates: allowable = 0 for the duplicate line
- For clean claims (errorClass: none): overcharge = 0, letterContext = null

DECISION RULES (apply in this order to reduce ambiguity):
- If the identical CPT code appears twice on the same date from the same provider → ALWAYS Duplicate Charge
- If billed > 150% of commercial rate AND provider is in-network → ALWAYS Fee Schedule Violation, not Upcoding
- Use Upcoding ONLY when the E/M code complexity level is the clinical issue, not the dollar amount
- Use Unbundling ONLY when a specific NCCI edit bundles the component code into a comprehensive code billed the same day

CONFIDENCE AND AMBIGUITY:
- claudeConfidence: "high" = clear-cut evidence in the bill | "medium" = likely but needs chart review | "low" = possible but provider may have justification
- ambiguous: true if you cannot definitively classify from the bill alone
- If unsure of a specific NCCI edit number, describe the rule generally — do not fabricate citation numbers
- errorClass must be exactly one of: upcoding, duplicate, unbundling, fee-schedule, none`

// ── Internal helpers ───────────────────────────────────────────────────────────

async function runPass1Image(base64: string, mediaType: string): Promise<RawBillExtraction> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    temperature: 0,
    system: PASS1_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: base64 }
        },
        { type: 'text', text: 'Extract all line items from this medical bill and return the JSON.' }
      ]
    }]
  })
  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(raw.replace(/```json|```/g, '').trim()) as RawBillExtraction
}

async function runPass1Text(text: string): Promise<RawBillExtraction> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    temperature: 0,
    system: PASS1_SYSTEM,
    messages: [{
      role: 'user',
      content: `Extract all line items from this medical bill data and return the JSON:\n\n${text.slice(0, 8000)}`
    }]
  })
  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(raw.replace(/```json|```/g, '').trim()) as RawBillExtraction
}

async function runPass2(extraction: RawBillExtraction): Promise<ClassifiedLineItem[]> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 3000,
    temperature: 0,
    system: PASS2_SYSTEM,
    messages: [{
      role: 'user',
      content: `Classify each of these ${extraction.lineItems.length} line items for billing errors. Patient: ${extraction.patientName}, Facility: ${extraction.facility}, Date: ${extraction.dateOfService}.\n\nLine items:\n${JSON.stringify(extraction.lineItems, null, 2)}`
    }]
  })
  const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'
  return JSON.parse(raw.replace(/```json|```/g, '').trim()) as ClassifiedLineItem[]
}

// Merges Pass 1 raw data + Pass 2 classifications into a full Claim array,
// then runs RPS scoring on each claim.
function buildCaseData(
  extraction: RawBillExtraction,
  classifications: ClassifiedLineItem[],
  employerId: string
): CaseData {
  const rawClaims: Claim[] = extraction.lineItems.map((raw: RawLineItem, i: number) => {
    const cls = classifications[i] ?? {
      cpt: raw.cpt,
      error: 'None' as const,
      errorClass: 'none' as const,
      allowable: raw.billed,
      overcharge: 0,
      details: '',
      letterContext: null,
      claudeConfidence: 'low' as const,
      ambiguous: false,
    }
    return {
      id: uuid(),
      // Pass 1 fields
      cpt: raw.cpt,
      desc: raw.desc,
      provider: raw.provider,
      date: raw.date,
      billed: raw.billed,
      icd10: raw.icd10,
      units: raw.units,
      // Pass 2 fields
      error: cls.error,
      errorClass: cls.errorClass,
      allowable: cls.allowable,
      overcharge: cls.overcharge,
      details: cls.details,
      letterContext: cls.letterContext,
      claudeConfidence: cls.claudeConfidence,
      ambiguous: cls.ambiguous,
      // RPS fields — populated by applyRPSScoring below
      rps: null,
      rpsClass: null,
      confidence: null,
      rationale: null,
    }
  })

  const claims = applyRPSScoring(rawClaims)
  const overcharge = claims.reduce((s, c) => s + (c.overcharge || 0), 0)
  const flagged = claims.filter(c => c.overcharge > 0)
  const weightedRPS = computeWeightedRPS(claims)

  return {
    caseId: `BB-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    employer: { id: employerId, name: 'Uploaded Bill', employees: 'N/A', plan: 'Self-Insured', tpa: 'N/A' },
    patientName: extraction.patientName || 'Unknown Patient',
    dateOfService: extraction.dateOfService || 'Unknown Date',
    facility: extraction.facility || 'Unknown Facility',
    totalRecovered: 0,
    totalFlagged: flagged.length,
    totalAudited: claims.length,
    overcharge,
    activeDisputes: 0,
    weightedRPS,
    claims,
    activity: [{
      id: uuid(),
      type: 'teal',
      text: '<strong>Bill uploaded</strong> - AI audit initiated.',
      amount: null,
      ts: 'Just now'
    }],
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function parseBillFromBase64(
  base64: string,
  mediaType: string,
  employerId: string
): Promise<CaseData> {
  const extraction = await runPass1Image(base64, mediaType)
  const classifications = await runPass2(extraction)
  return buildCaseData(extraction, classifications, employerId)
}

export async function parseBillFromText(
  text: string,
  employerId: string
): Promise<CaseData> {
  const extraction = await runPass1Text(text)
  const classifications = await runPass2(extraction)
  return buildCaseData(extraction, classifications, employerId)
}

// ── Dispute letter generation ──────────────────────────────────────────────────
// Unchanged — takes finalised Claim objects and generates the formal letter.

export async function generateDisputeLetter(
  claims: Claim[],
  caseData: CaseData
): Promise<import('./types').DisputeLetterData> {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  })

  const getErrorInstruction = (claim: Claim): string => {
    const instructions: Record<string, string> = {
      duplicate: `Cite that CPT ${claim.cpt} was submitted twice on the same date of service by the same provider. Under standard medical billing guidelines, duplicate claim submissions are not payable. The second submission has no clinical or administrative justification and must be reversed.`,
      unbundling: `Cite the NCCI (National Correct Coding Initiative) bundling edit that includes CPT ${claim.cpt} as a component procedure within the comprehensive code billed on the same date. Component codes cannot be billed separately when a comprehensive code covering the same service has been submitted. No modifier exception applies in this case.`,
      upcoding: `Cite that the clinical documentation for this encounter does not support the medical decision-making complexity required for CPT ${claim.cpt} under AMA CPT Evaluation and Management guidelines. The documented visit complexity is consistent with a lower-level code. The billed amount of $${claim.billed} reflects a code level that is not supported by the medical record.`,
      'fee-schedule': `Cite that the billed amount of $${claim.billed} for CPT ${claim.cpt} substantially exceeds the 80th percentile of commercial reimbursement rates for this procedure in this geographic region, as benchmarked against Fair Health commercial data and the employer plan's reasonable and customary reimbursement threshold. Do NOT reference Medicare or CMS rates. This is a self-insured commercial employer plan.`,
      none: claim.details
        ? `The plan administrator has flagged this charge for the following reason: ${claim.details}. Request full itemized documentation and supporting records for this service.`
        : `The plan administrator has flagged this charge for review. Request itemized documentation and supporting records.`
    }
    return instructions[claim.errorClass] || instructions['fee-schedule']
  }

  const claimsSection = claims.map((claim, i) => `
DISPUTED LINE ITEM ${i + 1}:
- CPT Code: ${claim.cpt} - ${claim.desc}
- Provider: ${claim.provider}
- Error Type: ${claim.error}
- Amount Billed: $${claim.billed.toLocaleString()}
- Commercially Reasonable Amount: $${claim.allowable.toLocaleString()}
- Disputed Amount: $${claim.overcharge.toLocaleString()}
- Dispute Basis: ${getErrorInstruction(claim)}`).join('\n')

  const totalDisputed = claims.reduce((s, c) => s + c.overcharge, 0)
  const cptList = claims.map(c => `CPT ${c.cpt}`).join(', ')

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: claims.length > 1 ? 2500 : 1500,
    messages: [{
      role: 'user',
      content: `You are drafting a formal medical billing dispute letter for a self-insured employer. Return ONLY a valid JSON object — no markdown, no code fences, no commentary.

The JSON must have exactly these fields:
{
  "recipientBlock": "Provider name and full mailing address, one line per \\n",
  "subject": "RE: Formal Billing Dispute — Claim #${caseData.caseId} | ${cptList}",
  "salutation": "Dear Provider Relations Department,",
  "paragraphs": [
    "Opening paragraph: employer identity, ERISA plan rights, and purpose of letter.",
    "One paragraph per disputed line item — numbered (1., 2., etc.), stating CPT code, error type, billed amount, allowable amount, disputed amount, and the legal/clinical basis for the dispute.",
    "Summary paragraph: total disputed amount of $${totalDisputed.toLocaleString()} across all line items, and demand for corrected EOB or full refund within 30 calendar days.",
    "Escalation paragraph: notice that failure to respond within 30 days may result in referral to the state insurance commissioner and escalation to legal counsel."
  ],
  "signature": "Sincerely,\\n\\nBenefits Administrator\\n${caseData.employer.name}",
  "cc": "CC: Third-Party Administrator | Legal Counsel | BillBack AI Claims File #${caseData.caseId}"
}

Case Details:
- Employer (Plan Sponsor): ${caseData.employer.name}
- Date: ${today}
- Claim Reference: #${caseData.caseId}
- Patient: ${caseData.patientName}
- Date of Service: ${caseData.dateOfService}
- Total Disputed Amount: $${totalDisputed.toLocaleString()}
${claimsSection}

IMPORTANT RULES:
- Never reference Medicare, CMS, or Medicaid rates — this is a commercial self-insured ERISA plan
- Use commercial benchmark language: Fair Health, reasonable and customary, 80th percentile commercial rates
- Use formal legal language throughout
- No markdown, no asterisks, no bullet points inside paragraph text
- Do not use em dashes
- Each paragraph in the "paragraphs" array must be a single plain-text string with no line breaks inside it`
    }]
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  return JSON.parse(json) as import('./types').DisputeLetterData
}
