'use client'

import { CaseData, Claim, ErrorClass } from '@/lib/types'
import { computeWeightedRPS } from '@/lib/rps'

interface Props { caseData: CaseData; onDispute: (claimId: string) => void; onDisputeAll: () => void }

const ERROR_STYLES: Record<ErrorClass, string> = {
  upcoding:       'bg-[#FDE8E8] text-[#E53935]',
  duplicate:      'bg-[#FDE8E8] text-[#E53935]',
  unbundling:     'bg-[#FEF3DC] text-[#8B5E00]',
  'fee-schedule': 'bg-[#E8F4FE] text-[#1A6EA8]',
  none:           'bg-[#E8FAF5] text-[#00BFA5]',
}

const RPS_STYLES: Record<string, string> = {
  high: 'bg-[#00BFA5]/10 text-[#00BFA5]',
  med:  'bg-[#F5C242]/15 text-[#8B6000]',
  low:  'bg-[#E53935]/10 text-[#E53935]',
}

function ErrorBadge({ error, errorClass }: { error: string; errorClass: ErrorClass }) {
  return (
    <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide ${ERROR_STYLES[errorClass]}`}>
      {error}
    </span>
  )
}

function RPSBadge({ rps, rpsClass }: { rps: number | null; rpsClass: string | null }) {
  if (!rps || !rpsClass) return <span className="text-[#6B82A0] text-xs">—</span>
  return (
    <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full font-mono ${RPS_STYLES[rpsClass]}`}>
      {rps}%
    </span>
  )
}

export default function ClaimsTable({ caseData, onDispute, onDisputeAll }: Props) {
  const flagged = caseData.claims.filter(c => c.overcharge > 0)
  const totalOvercharge = caseData.claims.reduce((s, c) => s + c.overcharge, 0)
  const weightedRPS = computeWeightedRPS(caseData.claims)

  return (
    <div className="bg-white border border-[#DDE6EF] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-5 py-3.5 border-b border-[#DDE6EF] flex items-center gap-3">
        <h3 className="text-sm font-bold text-[#0F1F3D] truncate">
          Flagged Overcharges: Case #{caseData.caseId}
        </h3>
        <span className="bg-[#0ABFBC]/10 text-[#07908E] text-[11px] font-bold px-2 py-0.5 rounded-md flex-shrink-0">
          {flagged.length} Active
        </span>
        <span className="ml-auto text-xs text-[#6B82A0] hidden sm:block">All Error Types</span>
      </div>

      {/* Mobile card view */}
      <div className="block sm:hidden divide-y divide-[#F0F4F8]">
        {caseData.claims.map((claim) => (
          <div key={claim.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div>
                <span className="font-mono text-sm font-bold text-[#0F1F3D]">{claim.cpt}</span>
                <p className="text-[11px] text-[#6B82A0] mt-0.5 leading-snug">{claim.desc}</p>
              </div>
              {claim.overcharge > 0
                ? <span className="font-mono text-sm font-bold text-[#E53935] flex-shrink-0">${claim.overcharge.toLocaleString()}</span>
                : <span className="font-mono text-xs text-[#6B82A0] flex-shrink-0">$0</span>
              }
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ErrorBadge error={claim.error} errorClass={claim.errorClass} />
              {claim.rps && <RPSBadge rps={claim.rps} rpsClass={claim.rpsClass} />}
              {claim.letterContext && (
                <button
                  onClick={() => onDispute(claim.id)}
                  className="ml-auto bg-[#0ABFBC]/10 text-[#07908E] border border-[#0ABFBC]/25 text-[11px] font-bold px-2.5 py-1 rounded-md"
                >
                  Dispute →
                </button>
              )}
            </div>
          </div>
        ))}
        {totalOvercharge > 0 && (
          <div className="px-4 py-3 bg-[#F0F7FF] flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[#6B82A0]">Total Overcharge</div>
              <div className="font-mono text-base font-bold text-[#E53935]">${totalOvercharge.toLocaleString()}</div>
            </div>
            <button
              onClick={onDisputeAll}
              className="bg-[#0ABFBC] text-[#0F1F3D] text-[11px] font-bold px-3 py-1.5 rounded-md hover:bg-[#07908E] transition-colors"
            >
              Dispute All →
            </button>
          </div>
        )}
      </div>

      {/* Desktop table view */}
      <div className="hidden sm:block">
        <table className="w-full">
          <colgroup>
            <col />                       {/* CPT + desc — flexible */}
            <col className="w-[160px]" /> {/* Error badge */}
            <col className="w-[110px]" /> {/* Date */}
            <col className="w-[150px]" /> {/* Billed / Allowable */}
            <col className="w-[100px]" /> {/* Overcharge */}
            <col className="w-[70px]"  /> {/* RPS */}
            <col className="w-[100px]" /> {/* Action */}
          </colgroup>
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#DDE6EF]">
              {['CPT Code', 'Error Type', 'Date', 'Billed / Allowable', 'Overcharge', 'RPS', ''].map(h => (
                <th key={h} className="text-left text-[10px] uppercase tracking-wide text-[#6B82A0] font-semibold px-3 py-2.5 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {caseData.claims.map((claim) => (
              <tr key={claim.id} className="border-b border-[#F0F4F8] hover:bg-[#FAFCFF] transition-colors">
                <td className="px-3 py-2.5">
                  <div className="font-mono text-sm font-bold text-[#0F1F3D]">{claim.cpt}</div>
                  <div className="text-[11px] text-[#6B82A0] mt-0.5 truncate">{claim.desc}</div>
                </td>
                <td className="px-3 py-2.5">
                  <ErrorBadge error={claim.error} errorClass={claim.errorClass} />
                </td>
                <td className="px-3 py-2.5 text-xs text-[#6B82A0] whitespace-nowrap">{claim.date}</td>
                <td className="px-3 py-2.5">
                  <span className="text-xs font-mono text-[#0F1F3D]">${claim.billed.toLocaleString()}</span>
                  <span className="text-[10px] text-[#9BAABB] mx-1">/</span>
                  <span className="text-xs font-mono text-[#6B82A0]">${claim.allowable.toLocaleString()}</span>
                </td>
                <td className="px-3 py-2.5">
                  {claim.overcharge > 0
                    ? <span className="font-mono text-sm font-bold text-[#E53935]">${claim.overcharge.toLocaleString()}</span>
                    : <span className="font-mono text-xs text-[#9BAABB]">—</span>
                  }
                </td>
                <td className="px-3 py-2.5">
                  <RPSBadge rps={claim.rps} rpsClass={claim.rpsClass} />
                </td>
                <td className="px-3 py-2.5 text-center">
                  {claim.letterContext && (
                    <button
                      onClick={() => onDispute(claim.id)}
                      className="bg-[#0ABFBC]/10 text-[#07908E] border border-[#0ABFBC]/25 text-[11px] font-bold px-4 py-1.5 rounded-md hover:bg-[#0ABFBC]/20 transition-colors whitespace-nowrap"
                    >
                      Dispute →
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {/* Total row */}
            {totalOvercharge > 0 && (
              <tr className="bg-[#F0F7FF] border-t-2 border-[#DDE6EF]">
                <td colSpan={4} className="px-3 py-2.5 text-right text-xs font-bold text-[#1A2D5A] uppercase tracking-wide">
                  Total Overcharge
                </td>
                <td className="px-3 py-2.5">
                  <span className="font-mono text-sm font-bold text-[#E53935]">${totalOvercharge.toLocaleString()}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="bg-[#F5C242]/15 text-[#8B6000] text-xs font-bold font-mono px-2 py-1 rounded-full">
                    {weightedRPS}%
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={onDisputeAll}
                    className="bg-[#0ABFBC] text-[#0F1F3D] text-[11px] font-bold px-2.5 py-1 rounded-md hover:bg-[#07908E] transition-colors"
                  >
                    All
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
