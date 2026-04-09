import Anthropic from '@anthropic-ai/sdk'
import { CaseData, Claim } from './types'
import { applyRPSScoring, computeWeightedRPS } from './rps'
import { v4 as uuid } from 'uuid'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PARSE_SYSTEM = `You are a medical billing audit AI for BillBack AI, a payment integrity platform for self-insured employers.

Analyze the provided medical bill or EOB document and extract every line item. For each line item, determine if a billing error exists.

Error types to detect:
- Upcoding: Code billed at higher complexity/level than clinically documented
- Duplicate Charge: Same CPT code billed more than once on same date by same provider
- Unbundling: Component procedure billed separately when included in a comprehensive code per NCCI edits
- Fee Schedule Violation: Amount billed substantially exceeds commercial market rates
- None: No error detected

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "patientName": "Full Name",
  "dateOfService": "Month DD, YYYY",
  "facility": "Facility Name",
  "totalAudited": 10,
  "activeDisputes": 0,
  "claims": [
    {
      "cpt": "99215",
      "desc": "Service description",
      "error": "Upcoding",
      "errorClass": "upcoding",
      "provider": "Provider Name",
      "date": "Feb 14, 2024",
      "billed": 425,
      "allowable": 211,
      "overcharge": 214,
      "details": "Specific explanation of why this is an error, citing the specific guideline or rule violated (e.g. NCCI edit number, AMA CPT E/M guideline section, or Fair Health commercial benchmark). Format: [Evidence from bill] → [Guideline violated] → [Why this constitutes an error].",
      "letterContext": "description of error for use in formal dispute letter",
      "claudeConfidence": "high",
      "ambiguous": false
    }
  ],
  "activity": [
    {
      "type": "teal",
      "text": "<strong>Bill uploaded</strong> - AI audit initiated.",
      "amount": null,
      "ts": "Just now"
    }
  ]
}

CRITICAL RULES FOR ALLOWABLE AMOUNTS:
- This platform serves self-insured EMPLOYER plans, NOT Medicare/Medicaid
- Never use Medicare or CMS rates as the allowable amount benchmark
- Use the 80th percentile of COMMERCIAL rates for the geographic region
- Commercial rates are typically 130-200% of Medicare rates depending on CPT code and region
- For fee schedule violations: allowable = fair commercial market rate, not Medicare rate
- For upcoding: allowable = commercial rate for the correct lower-level code
- For unbundling: allowable = 0 (component code should not be billed at all)
- For duplicates: allowable = 0 for the duplicate line (original charge stands)
- errorClass must be exactly one of: upcoding, duplicate, unbundling, fee-schedule, none
- For clean claims: set overcharge to 0, letterContext to null, claudeConfidence to "high", ambiguous to false

CONFIDENCE AND AMBIGUITY RULES:
- claudeConfidence must be exactly one of: "high", "medium", "low"
  - "high": clear-cut error with direct evidence in the bill (e.g. exact duplicate line, specific NCCI edit applies)
  - "medium": likely error but requires chart review or additional documentation to confirm
  - "low": possible error but provider may have legitimate justification (e.g. modifier applies, documentation ambiguous)
- ambiguous: set to true if you cannot definitively classify the error from the bill alone, or if the error type is debatable
- When ambiguous is true or claudeConfidence is "low", still return your best classification but the system will route this to human review
- If you cannot find specific evidence in the bill to support an error classification, set errorClass to "none" — do NOT fabricate guideline citations
- Be specific in details. Only cite NCCI edits, AMA guidelines, or benchmarks you are certain apply. If unsure of the exact edit number, describe the rule in general terms rather than inventing a specific citation.
- IMPORTANT: Only include line items that have a valid CPT code. Do NOT include rows where the CPT code is missing, blank, or cannot be determined from the document.
- Return ONLY the JSON object`

export async function parseBillFromBase64(
  base64: string,
  mediaType: string,
  employerId: string
): Promise<CaseData> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4000,
    temperature: 0,
    system: PARSE_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: base64 }
        },
        { type: 'text', text: 'Analyze this medical bill and return the JSON audit result.' }
      ]
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const clean = text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)

  return buildCaseData(parsed, employerId)
}

export async function parseBillFromText(
  text: string,
  employerId: string
): Promise<CaseData> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4000,
    temperature: 0,
    system: PARSE_SYSTEM,
    messages: [{
      role: 'user',
      content: `Analyze this medical bill/claims data and return the JSON audit result:\n\n${text.slice(0, 8000)}`
    }]
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  const clean = raw.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)

  return buildCaseData(parsed, employerId)
}

function buildCaseData(parsed: Record<string, unknown>, employerId: string): CaseData {
  const rawClaims = (parsed.claims as Claim[]).filter((c: Claim) => c.cpt && String(c.cpt).trim() !== '').map((c: Claim) => ({
    ...c,
    id: uuid(),
    // Normalise Claude's self-reported confidence/ambiguity fields
    claudeConfidence: c.claudeConfidence ?? null,
    ambiguous: c.ambiguous ?? false,
    // Clear any RPS fields — the scoring engine will populate them
    rps: null,
    rpsClass: null,
    confidence: null,
    rationale: null,
  }))
  const claims = applyRPSScoring(rawClaims)
  const overcharge = claims.reduce((s, c) => s + (c.overcharge || 0), 0)
  const flagged = claims.filter(c => c.overcharge > 0)
  const weightedRPS = computeWeightedRPS(claims)
  const activity = ((parsed.activity as CaseData['activity']) || []).map((a: CaseData['activity'][number]) => ({ ...a, id: uuid() }))

  return {
    caseId: `BB-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    employer: { id: employerId, name: 'Uploaded Bill', employees: 'N/A', plan: 'Self-Insured', tpa: 'N/A' },
    patientName: (parsed.patientName as string) || 'Unknown Patient',
    dateOfService: (parsed.dateOfService as string) || 'Unknown Date',
    facility: (parsed.facility as string) || 'Unknown Facility',
    totalRecovered: 0,
    totalFlagged: flagged.length,
    totalAudited: (parsed.totalAudited as number) || claims.length,
    overcharge,
    activeDisputes: (parsed.activeDisputes as number) || 0,
    weightedRPS,
    claims,
    activity,
  }
}

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
  // Strip any accidental code fences Claude may emit
  const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  return JSON.parse(json) as import('./types').DisputeLetterData
}

// ── Parse-only (extract line items, no error classification) ─────────────

const PARSE_ONLY_SYSTEM = `You are a medical billing data extraction AI for BillBack AI.

Extract every line item from the provided medical bill or EOB document. Do NOT classify errors, assess overcharges, or determine allowable amounts — only extract the raw billing data as it appears on the document.

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "patientName": "Full Name",
  "dateOfService": "Month DD, YYYY",
  "facility": "Facility Name",
  "claims": [
    {
      "cpt": "99215",
      "desc": "Service description",
      "provider": "Provider Name",
      "date": "Feb 14, 2024",
      "billed": 425,
      "units": 1
    }
  ]
}

RULES:
- Only include line items that have a valid CPT code. Do NOT include rows where CPT is missing or blank.
- Extract billed amounts exactly as they appear — do not modify them.
- Do not infer, calculate, or estimate allowable amounts.
- Omit the units field if not shown on the bill.
- Return ONLY the JSON object`

const CLASSIFY_SYSTEM_BASE = `You are a medical billing audit AI for BillBack AI, a payment integrity platform for self-insured employers.

You will receive already-extracted and user-verified medical bill line items. Classify each for billing errors and determine the commercially allowable amount.

ERROR TYPES:
- Upcoding: Code billed at higher complexity than clinically documented
- Duplicate Charge: Same CPT billed more than once on same date by same provider
- Unbundling: Component billed separately when included in a comprehensive code per NCCI edits
- Fee Schedule Violation: Amount exceeds the 80th percentile commercial benchmark by more than 25%
- None: No error detected

ERROR PRIORITY (when a claim qualifies for multiple error types, apply the first that fits):
  1. Duplicate Charge
  2. Unbundling
  3. Upcoding
  4. Fee Schedule Violation

MODIFIER RULES:
- If a claim carries modifier 59 or XU, do not classify as unbundling unless you have specific evidence the modifier was applied inappropriately
- If a claim carries modifier 25, do not flag the associated E/M as a duplicate of a procedure on the same date — modifier 25 indicates a separate, significant evaluation
- If a claim carries modifier 51, do not flag as unbundling — modifier 51 indicates multiple procedures at the same session, which may be legitimate
- When a modifier is present and you cannot confirm it is inappropriate, set claudeConfidence to "low" and ambiguous to true

CONFIDENCE LEVELS:
- "high": clear-cut error with direct evidence (e.g. exact duplicate line, specific NCCI edit applies, fee clearly exceeds benchmark)
- "medium": likely error but requires chart review or additional documentation to confirm
- "low": possible error but provider may have legitimate justification (modifier applies, documentation ambiguous)

FEE SCHEDULE VIOLATION THRESHOLD:
- Only flag as Fee Schedule Violation if the billed amount exceeds the 80th percentile COMMERCIAL rate by more than 25%
- Use commercial rates only — never Medicare or CMS rates
- If billed is within 25% of the commercial benchmark, classify as "None"

Return all original claim fields PLUS these classification fields for each claim:
- error: one of "Upcoding", "Duplicate Charge", "Unbundling", "Fee Schedule Violation", "None"
- errorClass: one of "upcoding", "duplicate", "unbundling", "fee-schedule", "none"
- allowable: 80th percentile COMMERCIAL rate (never Medicare/CMS)
- overcharge: billed - allowable (0 for clean claims)
- details: use this exact format: [Evidence from bill] → [Guideline violated] → [Why this constitutes an error]. If clinical notes were provided, cite specific documentation gaps or inconsistencies found in the notes.
- letterContext: text for dispute letter (null for clean claims)
- claudeConfidence: "high", "medium", or "low"
- ambiguous: true if cannot definitively classify, otherwise false

CRITICAL RULES:
- Never use Medicare or CMS rates — use 80th percentile COMMERCIAL rates
- For unbundling: allowable = 0 (the component code should not have been billed — work already compensated by the comprehensive code)
- For duplicates: allowable = 0 for the duplicate line only (the original charge stands)
- For clean claims: overcharge = 0, letterContext = null
- If clinical notes are provided and directly contradict a billed code, set claudeConfidence to "high" and ambiguous to false
- Do NOT fabricate guideline citations — if unsure of an exact edit number, describe the rule in general terms

Return ONLY a valid JSON object (no markdown):
{
  "activeDisputes": 0,
  "claims": [...all claims with original fields + classification fields...],
  "activity": [
    {
      "type": "teal",
      "text": "<strong>Bill audited</strong> — AI error classification complete.",
      "amount": null,
      "ts": "Just now"
    }
  ]
}`

function buildClassifySystem(clinicalNotes?: string): string {
  if (!clinicalNotes || !clinicalNotes.trim()) return CLASSIFY_SYSTEM_BASE
  const notesBlock = `
CLINICAL DOCUMENTATION PROVIDED:
The following clinical notes were uploaded by the employer. Use them as the authoritative record of what was documented and performed:

${clinicalNotes.trim()}

Apply these notes when classifying:
- Upcoding: Does the documented complexity (history, exam, MDM) actually support the billed E/M level? If the notes reflect a lower level of service, flag as upcoding.
- Unbundling: Were component procedures described as part of a single encounter or comprehensive service? If so, flag separate billing as unbundling per NCCI edits.
- Medical necessity: Are the billed services consistent with the documented clinical indication? Flag discrepancies in details.`
  return CLASSIFY_SYSTEM_BASE.replace(
    'Return all original claim fields',
    `${notesBlock}\n\nReturn all original claim fields`
  )
}

interface RawParsedBill {
  patientName: string
  dateOfService: string
  facility: string
  claims: Array<{ cpt: string; desc: string; provider: string; date: string; billed: number; units?: number }>
}

export async function parseBillOnly(base64: string, mediaType: string): Promise<RawParsedBill> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    temperature: 0,
    system: PARSE_ONLY_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: base64 } },
        { type: 'text', text: 'Extract all line items from this medical bill.' }
      ]
    }]
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim()) as RawParsedBill
  parsed.claims = (parsed.claims || []).filter(c => c.cpt && String(c.cpt).trim() !== '')
  return parsed
}

export async function parseBillOnlyFromText(content: string): Promise<RawParsedBill> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    temperature: 0,
    system: PARSE_ONLY_SYSTEM,
    messages: [{
      role: 'user',
      content: `Extract all line items from this medical bill:\n\n${content.slice(0, 8000)}`
    }]
  })
  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()) as RawParsedBill
  parsed.claims = (parsed.claims || []).filter(c => c.cpt && String(c.cpt).trim() !== '')
  return parsed
}

export async function classifyAndBuildCase(
  rawClaims: Array<{ cpt: string; desc: string; provider: string; date: string; billed: number; units?: number }>,
  meta: { patientName: string; dateOfService: string; facility: string },
  employerId: string,
  clinicalNotes?: string
): Promise<CaseData> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4000,
    temperature: 0,
    system: buildClassifySystem(clinicalNotes),
    messages: [{
      role: 'user',
      content: `Classify these medical bill line items for billing errors:\n\n${JSON.stringify(rawClaims, null, 2)}`
    }]
  })
  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  const classified = JSON.parse(raw.replace(/```json|```/g, '').trim())
  return buildCaseData({ ...classified, ...meta }, employerId)
}
