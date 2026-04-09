'use client'

import { useState, useEffect } from 'react'
import { CaseData, Claim, ErrorType } from '@/lib/types'
import { CheckCircle2, ChevronDown, ChevronUp, FileText, ImageIcon } from 'lucide-react'

const ERROR_TYPES: ErrorType[] = ['None', 'Upcoding', 'Duplicate Charge', 'Unbundling', 'Fee Schedule Violation']

const ERROR_COLORS: Record<ErrorType, string> = {
  'None':                  'bg-gray-100 text-gray-500',
  'Upcoding':              'bg-orange-50 text-orange-600',
  'Duplicate Charge':      'bg-red-50 text-red-600',
  'Unbundling':            'bg-purple-50 text-purple-600',
  'Fee Schedule Violation':'bg-yellow-50 text-yellow-700',
}

interface Props {
  caseData: CaseData
  billImage: string | null
  onUpdate: (updated: CaseData) => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-[#9BAABB] uppercase tracking-wider">{label}</span>
      {children}
    </div>
  )
}

const inputCls = "w-full bg-transparent border-b border-gray-200 focus:border-[#0ABFBC] outline-none text-xs text-[#0F1F3D] py-1 transition-colors placeholder:text-gray-300"
const numCls   = `${inputCls} tabular-nums`

export default function BillPreviewPanel({ caseData, billImage, onUpdate }: Props) {
  const [open, setOpen]       = useState(true)
  const [claims, setClaims]   = useState<Claim[]>(caseData.claims)
  const [saved, setSaved]     = useState(false)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!billImage) return
    if (billImage.startsWith('data:application/pdf')) {
      const byteString = atob(billImage.split(',')[1])
      const bytes = new Uint8Array(byteString.length)
      for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setBlobUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [billImage])

  const updateClaim = (id: string, field: keyof Claim, value: string | number) => {
    setClaims(prev => prev.map(c => {
      if (c.id !== id) return c
      const updated = { ...c, [field]: value }
      if (field === 'billed' || field === 'allowable') {
        updated.overcharge = Number(updated.billed) - Number(updated.allowable)
      }
      return updated
    }))
    setSaved(false)
  }

  const save = () => {
    onUpdate({ ...caseData, claims })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const hasImage = !!billImage
  const isPdf    = billImage?.startsWith('data:application/pdf') ?? false
  const hasText  = !!caseData.rawText

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* ── Header ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {hasImage
            ? <ImageIcon className="w-4 h-4 text-[#0ABFBC]" />
            : <FileText  className="w-4 h-4 text-[#0ABFBC]" />
          }
          <span className="text-sm font-semibold text-[#0F1F3D]">Bill Preview &amp; Verification</span>
          {!hasImage && !hasText && (
            <span className="text-[10px] text-[#9BAABB] bg-gray-100 px-2 py-0.5 rounded-full ml-1">Demo</span>
          )}
        </div>
        {open
          ? <ChevronUp   className="w-4 h-4 text-[#6B82A0]" />
          : <ChevronDown className="w-4 h-4 text-[#6B82A0]" />
        }
      </button>

      {open && (
        <div className="border-t border-gray-100">

          {/* ── Original bill ── */}
          {(hasImage || hasText) && (
            <div className="px-6 pt-5 pb-6 border-b border-gray-100 bg-[#F7F9FC]">
              <p className="text-[10px] uppercase tracking-[2px] text-[#9BAABB] font-semibold mb-3">Original Bill</p>
              {hasImage && isPdf ? (
                <object
                  data={blobUrl ?? ''}
                  type="application/pdf"
                  className="w-full h-72 rounded-xl border border-gray-200 bg-white shadow-sm"
                >
                  <p className="text-xs text-[#6B82A0] p-4">PDF preview not supported in this browser.</p>
                </object>
              ) : hasImage ? (
                <img
                  src={billImage!}
                  alt="Original bill"
                  className="max-h-72 object-contain rounded-xl border border-gray-200 bg-white mx-auto block shadow-sm"
                />
              ) : (
                <pre className="text-xs text-[#6B82A0] whitespace-pre-wrap font-mono bg-white border border-gray-200 rounded-xl p-4 max-h-48 overflow-y-auto leading-relaxed">
                  {caseData.rawText}
                </pre>
              )}
            </div>
          )}

          {/* ── Editable claims ── */}
          <div className="px-6 pt-5 pb-6">

            {/* Sub-header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-semibold text-[#0F1F3D]">Parsed Claims</p>
                <p className="text-[11px] text-[#9BAABB] mt-0.5">Review and correct any parsing errors before proceeding</p>
              </div>
              <button
                onClick={save}
                className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full transition-all duration-200 ${
                  saved
                    ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'
                    : 'bg-[#0F1F3D] text-white hover:bg-[#1A2D5A]'
                }`}
              >
                {saved ? <><CheckCircle2 className="w-3.5 h-3.5" />Saved</> : 'Save Corrections'}
              </button>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-[80px_1fr_140px_90px_90px_90px] gap-x-4 px-3 pb-2 border-b border-gray-100">
              {['CPT', 'Description', 'Error Type', 'Billed', 'Allowable', 'Overcharge'].map(h => (
                <span key={h} className="text-[10px] font-semibold text-[#9BAABB] uppercase tracking-wider">{h}</span>
              ))}
            </div>

            {/* Claim rows */}
            <div className="divide-y divide-gray-50">
              {claims.map((claim, i) => (
                <div
                  key={claim.id}
                  className="grid grid-cols-[80px_1fr_140px_90px_90px_90px] gap-x-4 items-center px-3 py-3 hover:bg-gray-50/60 transition-colors rounded-lg group"
                >
                  {/* CPT */}
                  <input
                    className={`${inputCls} font-mono`}
                    value={claim.cpt}
                    onChange={e => updateClaim(claim.id, 'cpt', e.target.value)}
                  />

                  {/* Description */}
                  <input
                    className={inputCls}
                    value={claim.desc}
                    onChange={e => updateClaim(claim.id, 'desc', e.target.value)}
                  />

                  {/* Error type */}
                  <div className="relative">
                    <select
                      className={`w-full appearance-none text-xs font-medium rounded-full px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-[#0ABFBC]/30 transition-all cursor-pointer ${ERROR_COLORS[claim.error]}`}
                      value={claim.error}
                      onChange={e => updateClaim(claim.id, 'error', e.target.value as ErrorType)}
                    >
                      {ERROR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  {/* Billed */}
                  <div className="flex items-center gap-0.5">
                    <span className="text-[10px] text-[#9BAABB]">$</span>
                    <input
                      type="number"
                      min={0}
                      className={numCls}
                      value={claim.billed}
                      onChange={e => updateClaim(claim.id, 'billed', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* Allowable */}
                  <div className="flex items-center gap-0.5">
                    <span className="text-[10px] text-[#9BAABB]">$</span>
                    <input
                      type="number"
                      min={0}
                      className={numCls}
                      value={claim.allowable}
                      onChange={e => updateClaim(claim.id, 'allowable', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* Overcharge — read-only, colour-coded */}
                  <span className={`text-xs font-semibold tabular-nums ${claim.overcharge > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    ${claim.overcharge.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
