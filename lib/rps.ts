/**
 * RPS (Recovery Probability Score) Scoring Engine
 *
 * Delegates to the trained rpsModel (AUC 0.9777, Accuracy 94.1%, R² 0.9218)
 * built from 900 synthetic claims. Weights are baked in — no training data
 * loaded at runtime.
 */

import { predictRPS } from './rpsModel'
import { Claim } from './types'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Apply RPS scoring to a list of claims.
 * Adds probability (as `rps` 0–100), confidence (0–1), rpsClass, and rationale.
 */
export function applyRPSScoring(claims: Claim[]): Claim[] {
  const duplicateCandidates = findRuleBasedDuplicates(claims)

  return claims.map(claim => {
    if (claim.errorClass === 'none' || claim.overcharge <= 0) {
      return { ...claim, rps: null, rpsClass: null, confidence: null, rationale: null }
    }

    // Rule-based duplicate detection overrides errorClass if Claude missed it
    const errorClass = (duplicateCandidates.has(claim.id) && claim.errorClass !== 'duplicate')
      ? 'duplicate'
      : claim.errorClass

    const result = predictRPS({
      error: claim.error,
      errorClass,
      allowable: claim.allowable,
      overcharge: claim.overcharge,
      details: claim.details,
      letterContext: claim.letterContext,
      claudeConfidence: claim.claudeConfidence ?? 'low',
      ambiguous: claim.ambiguous ?? false,
    })

    const rps = Math.round(result.rpsScore * 100)
    const rpsClass = result.confidenceTier === 'HIGH' ? 'high'
      : result.confidenceTier === 'MEDIUM' ? 'med'
      : 'low'

    return { ...claim, rps, rpsClass, confidence: result.rpsScore, rationale: result.rationale }
  })
}

/**
 * Compute a dollar-weighted average RPS across all flagged claims.
 * Larger overcharges have more influence on the case-level score.
 */
export function computeWeightedRPS(claims: Claim[]): number {
  const flagged = claims.filter(c => c.rps !== null && c.overcharge > 0)
  if (flagged.length === 0) return 0

  const totalOvercharge = flagged.reduce((s, c) => s + c.overcharge, 0)
  if (totalOvercharge === 0) return 0

  const weightedSum = flagged.reduce((s, c) => s + (c.rps! * c.overcharge), 0)
  return Math.round(weightedSum / totalOvercharge)
}

/**
 * Rule-based duplicate detection.
 * Flags claim IDs where the same CPT code appears more than once
 * on the same date from the same provider — independent of Claude's classification.
 */
function findRuleBasedDuplicates(claims: Claim[]): Set<string> {
  const duplicates = new Set<string>()
  const seen = new Map<string, string>() // key → first claim id

  for (const claim of claims) {
    const key = `${claim.cpt}|${claim.date}|${claim.provider}`
    if (seen.has(key)) {
      duplicates.add(claim.id)
      duplicates.add(seen.get(key)!)
    } else {
      seen.set(key, claim.id)
    }
  }

  return duplicates
}

/**
 * Recommendation text for the RPS panel action card.
 */
export function getRecommendation(
  claims: Claim[],
  weightedRPS: number
): { title: string; desc: string; urgency: 'high' | 'med' | 'low' } {
  const flagged = claims.filter(c => c.overcharge > 0)
  const highConf = flagged.filter(c => (c.rps ?? 0) >= 75)
  const totalOvercharge = flagged.reduce((s, c) => s + c.overcharge, 0)

  if (weightedRPS >= 75) {
    return {
      urgency: 'high',
      title: `File disputes for ${highConf.length} high-probability claim${highConf.length !== 1 ? 's' : ''}`,
      desc: `$${totalOvercharge.toLocaleString()} in recoverable overcharges with ${weightedRPS}% weighted success probability. High-confidence errors — recommend immediate dispute filing.`,
    }
  }
  if (weightedRPS >= 45) {
    return {
      urgency: 'med',
      title: 'Review flagged claims before filing',
      desc: `${flagged.length} claim${flagged.length !== 1 ? 's' : ''} flagged with moderate recovery probability. Request supporting documentation before proceeding.`,
    }
  }
  return {
    urgency: 'low',
    title: 'Human review recommended',
    desc: `Low overall recovery probability (${weightedRPS}%). Claims may have ambiguous documentation — escalate to clinical review team before filing disputes.`,
  }
}
