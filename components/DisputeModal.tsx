'use client'

import { useEffect, useState } from 'react'
import { X, Copy, Download, Loader2, CheckCircle } from 'lucide-react'
import { Claim, CaseData, DisputeLetterData } from '@/lib/types'

interface Props {
  claim: Claim
  caseData: CaseData
  onClose: () => void
}

function letterToPlainText(d: DisputeLetterData): string {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return [
    today, '',
    d.recipientBlock, '',
    d.subject, '',
    d.salutation, '',
    ...d.paragraphs.flatMap(p => [p, '']),
    d.signature, '',
    d.cc,
  ].join('\n')
}

function BillBackStamp() {
  return (
    <div className="border-2 border-[#0ABFBC] rounded-md px-3 py-1.5 flex flex-col items-center gap-0.5 opacity-80">
      <div className="flex items-center gap-1">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-[#0ABFBC]">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-[#0ABFBC] font-black text-[11px] tracking-[2px] uppercase">BillBack</span>
      </div>
      <span className="text-[#0ABFBC]/70 text-[7px] tracking-[2.5px] uppercase font-semibold">AI Verified</span>
    </div>
  )
}

export default function DisputeModal({ claim, caseData, onClose }: Props) {
  const [letterData, setLetterData] = useState<DisputeLetterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Generate letter immediately on mount
  useEffect(() => {
    let cancelled = false
    async function generate() {
      try {
        const r = await fetch('/api/generate-dispute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ claims: [claim], caseData })
        })
        const { success, letterData: ld, error: err } = await r.json()
        if (cancelled) return
        if (success && ld) setLetterData(ld)
        else setError(err || 'Generation failed')
      } catch (e) {
        if (!cancelled) setError('Network error — please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    generate()
    return () => { cancelled = true }
  }, [claim, caseData])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const copy = () => {
    if (!letterData) return
    navigator.clipboard.writeText(letterToPlainText(letterData))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const download = () => {
    if (!letterData) return
    const blob = new Blob([letterToPlainText(letterData)], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `BillBack_Dispute_${caseData.caseId}_CPT${claim.cpt}.txt`
    a.click()
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-[#F7F9FC] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-[#0F1F3D]">Dispute Letter — CPT {claim.cpt}</h2>
            <p className="text-xs text-[#6B82A0] mt-0.5">{claim.desc} · {claim.error}</p>
          </div>
          <div className="flex items-center gap-2">
            {letterData && (
              <>
                <button
                  onClick={copy}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#0F1F3D] bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {copied ? <CheckCircle className="w-3.5 h-3.5 text-[#0ABFBC]" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={download}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0ABFBC] px-3 py-1.5 rounded-lg hover:bg-[#09ADAA] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
              </>
            )}
            <button onClick={onClose} className="ml-1 text-[#9BAABB] hover:text-[#0F1F3D] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-[#0ABFBC] animate-spin" />
              <p className="text-sm text-[#6B82A0]">Generating dispute letter…</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <p className="text-sm text-[#E53935] font-semibold">Failed to generate letter</p>
              <p className="text-xs text-[#9BAABB]">{error}</p>
            </div>
          )}

          {letterData && (
            <div className="bg-white shadow-sm rounded-xl max-w-2xl mx-auto px-8 py-10 relative font-serif text-[#1a1a2e]">
              <div className="absolute top-8 right-8"><BillBackStamp /></div>
              <p className="text-sm mb-8">{today}</p>
              <div className="text-sm mb-8 whitespace-pre-line leading-relaxed">{letterData.recipientBlock}</div>
              <p className="text-sm font-bold mb-6 underline underline-offset-2">{letterData.subject}</p>
              <p className="text-sm mb-5">{letterData.salutation}</p>
              <div className="space-y-4">
                {letterData.paragraphs.map((para, i) => (
                  <p key={i} className="text-sm leading-[1.75] text-justify">{para}</p>
                ))}
              </div>
              <div className="mt-10 text-sm whitespace-pre-line leading-relaxed">{letterData.signature}</div>
              <div className="mt-10 pt-4 border-t border-gray-200 text-xs text-gray-400 leading-relaxed">{letterData.cc}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
