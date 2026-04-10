'use client'

import { useEffect, useState } from 'react'
import { CaseData } from '@/lib/types'
import { getRecommendation } from '@/lib/rps'

interface Props { caseData: CaseData; onGenerateDisputes: () => void }


function AnimatedBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), delay + 300)
    return () => clearTimeout(t)
  }, [pct, delay])
  return (
    <div className="h-1 bg-[#DDE6EF] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-[1500ms] ease-out" style={{ width: `${width}%`, background: color }} />
    </div>
  )
}

export default function RPSPanel({ caseData, onGenerateDisputes }: Props) {
  const flagged = caseData.claims.filter(c => c.overcharge > 0)
  const rec = getRecommendation(caseData.claims, caseData.weightedRPS)
  const barColors = ['#00BFA5', '#0ABFBC', '#F5C242', '#1A6EA8']

  return (
    <div className="flex flex-col gap-3">

      {/* Claim Breakdown */}
      {flagged.length > 0 && (
        <div className="bg-white border border-[#DDE6EF] rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-[1px] text-[#6B82A0] font-semibold mb-2">
            Claim Breakdown
          </div>
          <div className="space-y-2.5">
            {flagged.map((c, i) => (
              <div key={c.id}>
                <div className="flex justify-between items-center mb-1">
                  <div className="text-[11px] text-[#0F1F3D] font-medium truncate mr-1">
                    CPT {c.cpt}
                  </div>
                  <div className="text-[11px] font-bold font-mono flex-shrink-0" style={{ color: barColors[i % barColors.length] }}>
                    {c.rps ?? 0}%
                  </div>
                </div>
                <div className="text-[10px] text-[#6B82A0] truncate mb-1">{c.error}</div>
                <AnimatedBar pct={c.rps ?? 0} color={barColors[i % barColors.length]} delay={i * 150} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Panel */}
      <div className="bg-gradient-to-br from-[#1A2D5A] to-[#0F1F3D] rounded-xl p-3">
        <div className="text-[10px] uppercase tracking-[1.5px] text-white/30 mb-1">
          {rec.urgency === 'high' ? '⚡ Recommended Action' : '📋 Recommended Action'}
        </div>
        <div className="text-xs font-semibold text-white mb-2.5 leading-snug">{rec.title}</div>
        <button
          onClick={onGenerateDisputes}
          className="w-full bg-[#0ABFBC] text-[#0F1F3D] text-xs font-bold py-2 rounded-lg hover:bg-[#07908E] transition-colors"
        >
          Generate Dispute Letters →
        </button>
      </div>

    </div>
  )
}
