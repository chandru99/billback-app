export type ErrorType = 'Upcoding' | 'Duplicate Charge' | 'Unbundling' | 'Fee Schedule Violation' | 'None'
export type ErrorClass = 'upcoding' | 'duplicate' | 'unbundling' | 'fee-schedule' | 'none'
export type RPSClass = 'high' | 'med' | 'low'

export type ClaudeConfidence = 'high' | 'medium' | 'low'

export interface Claim {
  id: string
  cpt: string
  desc: string
  error: ErrorType
  errorClass: ErrorClass
  provider: string
  date: string
  rps: number | null
  rpsClass: RPSClass | null
  // Scoring engine outputs
  confidence: number | null    // 0–1 model confidence from RPS engine
  rationale: string | null     // human-readable prediction rationale
  // Claude hallucination control
  claudeConfidence: ClaudeConfidence | null  // Claude's self-reported certainty
  ambiguous: boolean | null    // Claude flagged this as ambiguous → route to human review
  billed: number
  allowable: number
  overcharge: number
  details: string
  letterContext: string | null
  icd10?: string
  units?: number
}

export interface Employer {
  id: string
  name: string
  employees: string
  plan: string
  tpa: string
}

export interface CaseData {
  caseId: string
  employer: Employer
  patientName: string
  dateOfService: string
  facility: string
  totalFlagged: number
  totalAudited: number
  overcharge: number
  activeDisputes: number
  weightedRPS: number
  claims: Claim[]
  rawText?: string
}

export interface ParseBillResponse {
  success: boolean
  data?: CaseData
  error?: string
}

export interface DisputeLetterData {
  recipientBlock: string   // Provider name + address, newline-separated
  subject: string          // Subject line
  salutation: string       // Dear ...
  paragraphs: string[]     // Body paragraphs
  signature: string        // Closing + name + title, newline-separated
  cc: string               // CC line
}

export interface DisputeResponse {
  success: boolean
  letterData?: DisputeLetterData
  error?: string
}
