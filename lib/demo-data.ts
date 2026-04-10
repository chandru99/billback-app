import { CaseData, Claim } from './types'
import { applyRPSScoring, computeWeightedRPS } from './rps'

export const DEMO_EMPLOYERS = [
  { id: 'meridian', name: 'Meridian Corp.', employees: '1,200', plan: 'Self-Insured PPO', tpa: 'Aetna TPA' },
  { id: 'pinnacle', name: 'Pinnacle Industries', employees: '3,400', plan: 'Self-Insured HDHP', tpa: 'Cigna TPA' },
  { id: 'coastal', name: 'Coastal Health Systems', employees: '850', plan: 'Level-Funded PPO', tpa: 'UHC TPA' },
]

// Base claim fields only — rps, rpsClass, confidence, rationale computed below by the engine
type RawClaim = Omit<Claim, 'rps' | 'rpsClass' | 'confidence' | 'rationale'>

function buildCase(
  base: Omit<CaseData, 'weightedRPS' | 'claims'>,
  rawClaims: RawClaim[]
): CaseData {
  // Seed scoring fields as null so applyRPSScoring can populate them
  const seeded: Claim[] = rawClaims.map(c => ({
    ...c,
    rps: null,
    rpsClass: null,
    confidence: null,
    rationale: null,
  }))
  const claims = applyRPSScoring(seeded)
  const weightedRPS = computeWeightedRPS(claims)
  return { ...base, claims, weightedRPS }
}

// ─── Meridian Corp ────────────────────────────────────────────────────────────

const meridianRaw: RawClaim[] = [
  {
    id: 'c1', cpt: '99215', desc: 'Office Visit, Level 5 E&M',
    error: 'Upcoding', errorClass: 'upcoding',
    provider: 'NorthStar Medical Group', date: 'Feb 14, 2024',
    claudeConfidence: 'high', ambiguous: false,
    billed: 425, allowable: 211, overcharge: 214,
    details: 'CPT 99215 billed at $425. Appropriate code is 99214 at $211. Documented visit complexity (stable vitals, routine follow-up, no new diagnosis) does not meet AMA CPT E/M guidelines for Level 5 medical decision-making threshold. Commercial benchmark for 99214 is $211.',
    letterContext: 'upcoding of CPT 99215 (Level 5 E&M visit, $425) which should have been billed as CPT 99214 (Level 4, $211) based on documented visit complexity that does not meet AMA E/M guidelines for Level 5 medical decision-making',
  },
  {
    id: 'c2', cpt: '71046', desc: 'Chest X-Ray, 2 Views',
    error: 'Duplicate Charge', errorClass: 'duplicate',
    provider: 'NorthStar Medical Group', date: 'Feb 14, 2024',
    claudeConfidence: 'high', ambiguous: false,
    billed: 710, allowable: 355, overcharge: 355,
    details: 'CPT 71046 billed twice on the same date of service by the same provider. Only one imaging session was performed and documented in the medical record. Per billing guidelines, duplicate claim submissions on the same date by the same provider are not payable.',
    letterContext: 'duplicate billing of CPT 71046 (Chest X-Ray, 2 Views, $355) submitted twice on February 14, 2024 by the same provider with only one imaging session documented',
  },
  {
    id: 'c3', cpt: '27310', desc: 'Arthrotomy, Knee',
    error: 'Unbundling', errorClass: 'unbundling',
    provider: 'Summit Orthopedics', date: 'Feb 14, 2024',
    claudeConfidence: 'high', ambiguous: false,
    billed: 1580, allowable: 0, overcharge: 1580,
    details: 'CPT 27310 (Arthrotomy, Knee) billed separately alongside CPT 27447 (Total Knee Arthroplasty). Per NCCI bundling edits, CPT 27310 is a component procedure included in CPT 27447\'s global surgical package and cannot be billed independently.',
    letterContext: 'unbundling of CPT 27310 (Arthrotomy, Knee, $1,580) which is a component procedure included within CPT 27447 (Total Knee Arthroplasty) per NCCI bundling rules and cannot be billed separately',
  },
  {
    id: 'c4', cpt: '85025', desc: 'Complete Blood Count (CBC)',
    error: 'None', errorClass: 'none',
    provider: 'NorthStar Medical Group', date: 'Feb 14, 2024',
    claudeConfidence: 'high', ambiguous: false,
    billed: 62, allowable: 58.50, overcharge: 0,
    details: 'No billing error detected. Charge within acceptable range.',
    letterContext: null,
  },
  {
    id: 'c5', cpt: '93000', desc: 'Electrocardiogram (ECG)',
    error: 'None', errorClass: 'none',
    provider: 'NorthStar Medical Group', date: 'Feb 14, 2024',
    claudeConfidence: 'high', ambiguous: false,
    billed: 89, allowable: 89, overcharge: 0,
    details: 'No billing error detected.',
    letterContext: null,
  },
]

// ─── Pinnacle Industries ──────────────────────────────────────────────────────

const pinnacleRaw: RawClaim[] = [
  {
    id: 'p1', cpt: '99285', desc: 'Emergency Dept Visit, Level 5',
    error: 'Upcoding', errorClass: 'upcoding',
    provider: 'Riverside Medical Center', date: 'Mar 2, 2024',
    claudeConfidence: 'high', ambiguous: false,
    billed: 1240, allowable: 680, overcharge: 560,
    details: 'CPT 99285 (ED Level 5, $1,240) billed for visit documented at Level 3 complexity. Clinical notes reflect moderate severity with no high-complexity decision-making per AMA CPT E/M guidelines. CPT 99283 ($680) is the appropriate commercial benchmark code.',
    letterContext: 'upcoding of CPT 99285 (Emergency Department Visit Level 5, $1,240) which should be CPT 99283 (Level 3, $680) based on documented moderate complexity and clinical notes',
  },
  {
    id: 'p2', cpt: '36415', desc: 'Routine Venipuncture',
    error: 'Duplicate Charge', errorClass: 'duplicate',
    provider: 'Riverside Medical Center', date: 'Mar 2, 2024',
    claudeConfidence: 'high', ambiguous: false,
    billed: 60, allowable: 30, overcharge: 30,
    details: 'CPT 36415 billed three times on same date. Per billing guidelines, maximum one venipuncture is billable per encounter regardless of number of tubes collected. Two of three submissions are duplicate charges.',
    letterContext: 'duplicate billing of CPT 36415 (Routine Venipuncture) billed three times on the same date of service when only one charge is billable per encounter',
  },
  {
    id: 'p3', cpt: '29826', desc: 'Shoulder Arthroscopy',
    error: 'Unbundling', errorClass: 'unbundling',
    provider: 'Riverside Orthopedic Surgery Center', date: 'Mar 2, 2024',
    claudeConfidence: 'high', ambiguous: false,
    billed: 4200, allowable: 0, overcharge: 4200,
    details: 'CPT 29826 billed separately with CPT 29827 (Rotator Cuff Repair). Per NCCI edits, CPT 29826 is bundled within CPT 29827 and cannot be billed independently when performed in the same operative session.',
    letterContext: 'unbundling of CPT 29826 (Shoulder Arthroscopy) billed separately alongside CPT 29827 (Rotator Cuff Repair) in violation of NCCI bundling edits',
  },
  {
    id: 'p4', cpt: '93306', desc: 'Echocardiogram with Doppler',
    error: 'Fee Schedule Violation', errorClass: 'fee-schedule',
    provider: 'Riverside Cardiology Associates', date: 'Mar 2, 2024',
    claudeConfidence: 'high', ambiguous: false,
    billed: 2840, allowable: 1220, overcharge: 1620,
    details: 'CPT 93306 billed at $2,840 which exceeds the contracted in-network rate of $1,220 (133% above allowed amount) per employer plan agreement. Provider is in-network and bound by contracted fee schedule. Fair Health commercial benchmark for this region is $1,220.',
    letterContext: 'fee schedule violation for CPT 93306 (Echocardiogram with Doppler) billed at $2,840 which exceeds the contracted in-network rate of $1,220 per the employer plan agreement',
  },
]

// ─── Coastal Health Systems ───────────────────────────────────────────────────

const coastalRaw: RawClaim[] = [
  {
    id: 'co1', cpt: '43239', desc: 'Upper GI Endoscopy with Biopsy',
    error: 'Unbundling', errorClass: 'unbundling',
    provider: 'Pacific Gastroenterology Group', date: 'Jan 28, 2024',
    claudeConfidence: 'high', ambiguous: false,
    billed: 3100, allowable: 0, overcharge: 3100,
    details: 'CPT 43239 billed with CPT 43235 (Diagnostic Upper Endoscopy). Per NCCI component code edits, CPT 43235 is a component of 43239 and cannot be billed separately when a biopsy is performed in the same session.',
    letterContext: 'unbundling of CPT 43235 (Diagnostic Upper Endoscopy) billed separately alongside CPT 43239 (Upper GI Endoscopy with Biopsy) in violation of NCCI component code edits',
  },
  {
    id: 'co2', cpt: '99213', desc: 'Office Visit, Level 3 E&M',
    error: 'None', errorClass: 'none',
    provider: 'Pacific Gastroenterology Group', date: 'Jan 28, 2024',
    claudeConfidence: 'high', ambiguous: false,
    billed: 180, allowable: 175, overcharge: 0,
    details: 'No billing error detected.',
    letterContext: null,
  },
  {
    id: 'co3', cpt: '70553', desc: 'MRI Brain with Contrast',
    error: 'Fee Schedule Violation', errorClass: 'fee-schedule',
    provider: 'Pacific Imaging Center', date: 'Jan 28, 2024',
    claudeConfidence: 'high', ambiguous: false,
    billed: 4800, allowable: 1660, overcharge: 3140,
    details: 'CPT 70553 billed at $4,800. Provider is in-network. Fair Health commercial benchmark for this region is $1,660. Billed amount exceeds contracted rate by 189%. Employer plan contract caps reimbursement at the contracted commercial rate.',
    letterContext: 'fee schedule violation for CPT 70553 (MRI Brain with Contrast) billed at $4,800 which exceeds the contracted in-network rate of $1,660 per the employer plan agreement',
  },
]

// ─── Build and export — scores computed by engine at module load ──────────────

export const DEMO_CASES: Record<string, CaseData> = {
  meridian: buildCase({
    caseId: 'BB-2024-0047',
    employer: { id: 'meridian', name: 'Meridian Corp.', employees: '1,200', plan: 'Self-Insured PPO', tpa: 'Aetna TPA' },
    patientName: 'James R. Mitchell',
    dateOfService: 'February 14, 2024',
    facility: 'NorthStar Health System',
    totalFlagged: 91,
    totalAudited: 2340,
    overcharge: 9630,
    activeDisputes: 7,
  }, meridianRaw),

  pinnacle: buildCase({
    caseId: 'BB-2024-0103',
    employer: { id: 'pinnacle', name: 'Pinnacle Industries', employees: '3,400', plan: 'Self-Insured HDHP', tpa: 'Cigna TPA' },
    patientName: 'Sarah K. Thornton',
    dateOfService: 'March 2, 2024',
    facility: 'Riverside Medical Center',
    totalFlagged: 218,
    totalAudited: 6820,
    overcharge: 14820,
    activeDisputes: 12,
  }, pinnacleRaw),

  coastal: buildCase({
    caseId: 'BB-2024-0082',
    employer: { id: 'coastal', name: 'Coastal Health Systems', employees: '850', plan: 'Level-Funded PPO', tpa: 'UHC TPA' },
    patientName: 'Marcus D. Rivera',
    dateOfService: 'January 28, 2024',
    facility: 'Pacific Surgery Center',
    totalFlagged: 44,
    totalAudited: 1180,
    overcharge: 6240,
    activeDisputes: 3,
  }, coastalRaw),
}
