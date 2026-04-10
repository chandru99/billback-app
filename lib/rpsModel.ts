/**
 * BillBack AI — RPS (Recover Probability Score) Model
 * =====================================================
 * Zero-dependency TypeScript inference.
 * Drop this file into your project and call `predictRPS(auditResult)`.
 *
 * Model stats (trained on 900 synthetic claims):
 *   Binary  AUC      : 0.9777
 *   Binary  Accuracy : 94.1 %
 *   Score   R²       : 0.9218
 *
 * Version : 1.0.0
 */

// ─── Types (match exactly what Claude's audit returns) ───────────────

export type ErrorClass =
  | 'upcoding'
  | 'duplicate'
  | 'unbundling'
  | 'fee-schedule'
  | 'none';

export type ErrorLabel =
  | 'Upcoding'
  | 'Duplicate Charge'
  | 'Unbundling'
  | 'Fee Schedule Violation'
  | 'None';

export type ClaudeConfidence = 'high' | 'medium' | 'low';

/** The object Claude's audit returns — fed directly into predictRPS() */
export interface ClaudeAuditResult {
  /** Human-readable label returned by Claude */
  error: ErrorLabel;
  /** Machine-readable key used by the model */
  errorClass: ErrorClass;
  /** 80th-percentile commercial rate Claude determines (number, e.g. 211) */
  allowable: number;
  /** billed − allowable (disputed dollar amount Claude calculates) */
  overcharge: number;
  /** Claude's audit finding: [Evidence] → [Guideline] → [Why error] */
  details: string;
  /** Pre-written dispute letter text; null for clean claims */
  letterContext: string | null;
  /** Claude's self-reported certainty */
  claudeConfidence: ClaudeConfidence;
  /** true if Claude flags the claim as needing human review */
  ambiguous: boolean;
}

/** Output of predictRPS() */
export interface RPSResult {
  /** Recover Probability Score — continuous 0 to 1 */
  rpsScore: number;
  /** Whether the model predicts a successful recovery (rpsScore > 0.5) */
  disputeRecommended: boolean;
  /** Human-readable confidence tier */
  confidenceTier: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Short rationale string for UI display */
  rationale: string;
}

// ─── Model weights (extracted from trained logistic regression) ───────
// Primary output: rpsScore via linear regression, clamped to [0, 1]
// Secondary output: disputeRecommended via logistic regression (AUC 0.978)

const REG_BIAS = 0.013334;
const REG_WEIGHTS = {
  ec_duplicate:        0.171591,
  'ec_fee-schedule':   0.134329,
  ec_upcoding:         0.094872,
  ec_unbundling:       0.058000,
  conf_high:           0.219689,
  conf_medium:         0.125061,
  ambiguous_int:      -0.126074,
  has_letter:          0.458793,
  log_overcharge_norm: 0.007382,
  overcharge_ratio:    0.041433,
} as const;

const LOG_BIAS = -3.354716;
const LOG_WEIGHTS = {
  ec_duplicate:        0.963232,
  'ec_fee-schedule':   0.999014,
  ec_upcoding:         0.677346,
  ec_unbundling:       0.240242,
  conf_high:           1.125811,
  conf_medium:         0.835735,
  ambiguous_int:      -1.178995,
  has_letter:          2.879834,
  log_overcharge_norm: 1.024721,
  overcharge_ratio:    1.624403,
} as const;

// ─── Feature engineering (mirrors Python training exactly) ────────────

function buildFeatures(audit: ClaudeAuditResult): Record<string, number> {
  const { errorClass, claudeConfidence, ambiguous, allowable, overcharge, letterContext } = audit;

  // Error class one-hot (reference = 'none')
  const ec_duplicate     = errorClass === 'duplicate'     ? 1 : 0;
  const ec_fee_schedule  = errorClass === 'fee-schedule'  ? 1 : 0;
  const ec_upcoding      = errorClass === 'upcoding'      ? 1 : 0;
  const ec_unbundling    = errorClass === 'unbundling'     ? 1 : 0;

  // Confidence one-hot (reference = 'low')
  const conf_high   = claudeConfidence === 'high'   ? 1 : 0;
  const conf_medium = claudeConfidence === 'medium' ? 1 : 0;

  // Binary
  const ambiguous_int = ambiguous ? 1 : 0;
  const has_letter    = letterContext !== null ? 1 : 0;

  // Numeric
  const safeOvercharge     = Math.max(overcharge, 1);
  const log_overcharge_norm = Math.log(safeOvercharge) / 10.0;
  const overcharge_ratio    = (allowable + overcharge) > 0
    ? overcharge / (allowable + overcharge)
    : 0;

  return {
    ec_duplicate,
    'ec_fee-schedule': ec_fee_schedule,
    ec_upcoding,
    ec_unbundling,
    conf_high,
    conf_medium,
    ambiguous_int,
    has_letter,
    log_overcharge_norm,
    overcharge_ratio,
  };
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

// ─── Rationale builder ───────────────────────────────────────────────

function buildRationale(audit: ClaudeAuditResult, rpsScore: number): string {
  const { errorClass, claudeConfidence, ambiguous, letterContext, overcharge } = audit;

  const parts: string[] = [];

  if (errorClass === 'none') {
    return 'No billing error detected — dispute not warranted.';
  }

  const errorLabels: Record<ErrorClass, string> = {
    duplicate:       'Duplicate charge',
    'fee-schedule':  'Fee schedule violation',
    upcoding:        'Upcoding',
    unbundling:      'Unbundling',
    none:            'No error',
  };
  parts.push(`${errorLabels[errorClass]} detected`);

  if (overcharge > 0) {
    parts.push(`$${overcharge.toFixed(0)} overcharge`);
  }
  parts.push(`Claude confidence: ${claudeConfidence}`);
  if (ambiguous)     parts.push('flagged as ambiguous');
  if (!letterContext) parts.push('no dispute letter context');

  return parts.join(' · ');
}

// ─── Main prediction function ─────────────────────────────────────────

/**
 * Predict the RPS (Recover Probability Score) for a claim.
 *
 * @param audit  The object returned by Claude's billing audit
 * @returns      RPSResult with rpsScore, recommendation, tier, and rationale
 */
export function predictRPS(audit: ClaudeAuditResult): RPSResult {
  const features = buildFeatures(audit);

  // ── Continuous rpsScore (linear regression, clamped) ──
  let regLogit = REG_BIAS;
  for (const [feat, val] of Object.entries(features)) {
    regLogit += (REG_WEIGHTS as Record<string, number>)[feat] * val;
  }
  const rpsScore = Math.round(clamp(regLogit, 0, 1) * 10000) / 10000;

  // ── Binary recommendation (logistic regression) ──
  let logLogit = LOG_BIAS;
  for (const [feat, val] of Object.entries(features)) {
    logLogit += (LOG_WEIGHTS as Record<string, number>)[feat] * val;
  }
  const disputeProb      = sigmoid(logLogit);
  const disputeRecommended = disputeProb > 0.5;

  // ── Confidence tier ──
  const confidenceTier: RPSResult['confidenceTier'] =
    rpsScore >= 0.70 ? 'HIGH' :
    rpsScore >= 0.40 ? 'MEDIUM' :
    'LOW';

  const rationale = buildRationale(audit, rpsScore);

  return { rpsScore, disputeRecommended, confidenceTier, rationale };
}

