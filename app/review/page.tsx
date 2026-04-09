'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'

interface RawClaim {
  id: string
  cpt: string
  desc: string
  provider: string
  date: string
  billed: number
  units?: number
}

interface ParsedBill {
  patientName: string
  dateOfService: string
  facility: string
  claims: RawClaim[]
}

const inputCls = "w-full bg-transparent border-b border-gray-200 focus:border-[#0ABFBC] outline-none text-xs text-[#0F1F3D] py-1 transition-colors placeholder:text-gray-300"

export default function ReviewPage() {
  const router = useRouter()
  const [parsedBill, setParsedBill] = useState<ParsedBill | null>(null)
  const [claims, setClaims]         = useState<RawClaim[]>([])
  const [billImage, setBillImage]   = useState<string | null>(null)
  const [identifying, setIdentifying] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem('billback_parsed_bill')
    if (!stored) { router.push('/'); return }
    const bill = JSON.parse(stored) as ParsedBill
    bill.claims = bill.claims.map(c => ({ ...c, id: c.id || uuid() }))
    setParsedBill(bill)
    setClaims(bill.claims)
    setBillImage(sessionStorage.getItem('billback_bill_image'))
  }, [router])

  const updateClaim = (id: string, field: keyof RawClaim, value: string | number) => {
    setClaims(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const removeClaim = (id: string) => {
    setClaims(prev => prev.filter(c => c.id !== id))
  }

  const addClaim = () => {
    setClaims(prev => [...prev, {
      id: uuid(),
      cpt: '',
      desc: '',
      provider: '',
      date: parsedBill?.dateOfService || '',
      billed: 0,
    }])
  }

  const identifyErrors = async () => {
    if (!parsedBill) return
    const valid = claims.filter(c => c.cpt.trim())
    if (!valid.length) { alert('Add at least one claim with a CPT code.'); return }
    setIdentifying(true)
    try {
      const clinicalNotesBase64 = sessionStorage.getItem('billback_clinical_notes_b64') || undefined
      const clinicalNotesMediaType = sessionStorage.getItem('billback_clinical_notes_type') || undefined
      const res = await fetch('/api/identify-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: parsedBill.patientName,
          dateOfService: parsedBill.dateOfService,
          facility: parsedBill.facility,
          claims: valid,
          clinicalNotesBase64,
          clinicalNotesMediaType,
        })
      })
      const { success, data, error } = await res.json()
      if (success && data) {
        sessionStorage.setItem('billback_case', JSON.stringify(data))
        router.push('/dashboard')
      } else {
        alert(`Error: ${error}`)
        setIdentifying(false)
      }
    } catch {
      alert('Failed to identify errors. Please try again.')
      setIdentifying(false)
    }
  }

  if (!parsedBill) return (
    <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#0ABFBC]/30 border-t-[#0ABFBC] rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F7F9FC] pb-24 xl:pb-0">

      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="text-[#6B82A0] hover:text-[#0F1F3D] transition-colors flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#0F1F3D] rounded-md flex items-center justify-center">
              <span className="text-[#0ABFBC] text-[10px] font-black">B</span>
            </div>
            <span className="text-sm font-bold text-[#0F1F3D]">BillBack AI</span>
          </div>
        </div>
        <button
          onClick={identifyErrors}
          disabled={identifying}
          className="hidden xl:flex items-center gap-2 bg-[#0ABFBC] text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-[#09ADAA] disabled:opacity-60 disabled:cursor-not-allowed transition-all group"
        >
          {identifying
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Identifying errors...</>
            : <>Identify Errors <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>
          }
        </button>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Page header */}
        <div className="mb-8">
          <p className="text-[10px] uppercase tracking-[3px] text-[#9BAABB] font-semibold mb-1">Step 1 of 2</p>
          <h1 className="text-2xl font-bold text-[#0F1F3D] tracking-tight">Review Parsed Bill</h1>
          <p className="text-sm text-[#6B82A0] mt-1">Correct any extraction errors below, then click "Identify Errors" to proceed.</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">

          {/* Claims card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Bill metadata */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#9BAABB] font-semibold mb-0.5">Patient</p>
                <p className="text-sm font-medium text-[#0F1F3D]">{parsedBill.patientName}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#9BAABB] font-semibold mb-0.5">Date of Service</p>
                <p className="text-sm font-medium text-[#0F1F3D]">{parsedBill.dateOfService}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#9BAABB] font-semibold mb-0.5">Facility</p>
                <p className="text-sm font-medium text-[#0F1F3D]">{parsedBill.facility}</p>
              </div>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-[80px_1fr_130px_100px_90px_36px] gap-x-4 px-6 py-3 border-b border-gray-100">
              {['CPT', 'Description', 'Provider', 'Date', 'Billed ($)', ''].map(h => (
                <span key={h} className="text-[10px] font-semibold text-[#9BAABB] uppercase tracking-wider">{h}</span>
              ))}
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-50">
              {claims.map(claim => (
                <div
                  key={claim.id}
                  className="grid grid-cols-[80px_1fr_130px_100px_90px_36px] gap-x-4 items-center px-6 py-3 hover:bg-gray-50/60 transition-colors group"
                >
                  <input
                    className={`${inputCls} font-mono`}
                    placeholder="00000"
                    value={claim.cpt}
                    onChange={e => updateClaim(claim.id, 'cpt', e.target.value)}
                  />
                  <input
                    className={inputCls}
                    placeholder="Description"
                    value={claim.desc}
                    onChange={e => updateClaim(claim.id, 'desc', e.target.value)}
                  />
                  <input
                    className={inputCls}
                    placeholder="Provider"
                    value={claim.provider}
                    onChange={e => updateClaim(claim.id, 'provider', e.target.value)}
                  />
                  <input
                    className={inputCls}
                    placeholder="Date"
                    value={claim.date}
                    onChange={e => updateClaim(claim.id, 'date', e.target.value)}
                  />
                  <div className="flex items-center gap-0.5">
                    <span className="text-[10px] text-[#9BAABB]">$</span>
                    <input
                      type="number"
                      min={0}
                      className={`${inputCls} tabular-nums`}
                      value={claim.billed}
                      onChange={e => updateClaim(claim.id, 'billed', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <button
                    onClick={() => removeClaim(claim.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 flex items-center justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add row */}
            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={addClaim}
                className="flex items-center gap-1.5 text-xs text-[#6B82A0] hover:text-[#0ABFBC] transition-colors font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add line item
              </button>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="flex flex-col gap-4">

            {/* Original bill image */}
            {billImage && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-[10px] uppercase tracking-[2px] text-[#9BAABB] font-semibold mb-3">Original Bill</p>
                {billImage.startsWith('data:application/pdf') ? (
                  <object
                    data={billImage}
                    type="application/pdf"
                    className="w-full h-72 rounded-xl border border-gray-100"
                  >
                    <p className="text-xs text-[#6B82A0] p-4">PDF preview not supported in this browser.</p>
                  </object>
                ) : (
                  <img
                    src={billImage}
                    alt="Original bill"
                    className="w-full object-contain rounded-xl border border-gray-100"
                  />
                )}
              </div>
            )}

            {/* What happens next */}
            <div className="bg-[#0F1F3D] rounded-2xl p-5 text-white">
              <p className="text-xs font-semibold mb-3 text-white/70 uppercase tracking-wider">What happens next</p>
              <ol className="space-y-3">
                {[
                  'Your corrected line items are sent for audit',
                  'AI classifies billing errors using NCCI rules',
                  'RPS scores calculated per claim',
                  'Full audit results shown on dashboard',
                ].map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-white/60">
                    <span className="w-4 h-4 rounded-full bg-[#0ABFBC]/20 text-[#0ABFBC] text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 xl:hidden">
        <button
          onClick={identifyErrors}
          disabled={identifying}
          className="w-full flex items-center justify-center gap-2 bg-[#0ABFBC] text-white text-sm font-semibold py-3.5 rounded-xl hover:bg-[#09ADAA] disabled:opacity-60 transition-all group"
        >
          {identifying
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Identifying errors...</>
            : <>Identify Errors <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>
          }
        </button>
      </div>
    </div>
  )
}
