'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, ArrowRight, CheckCircle2, Shield, TrendingUp, FileSearch } from 'lucide-react'

const EMPLOYERS = [
  { id: 'meridian',  name: 'Meridian Corp.',         employees: '1,200', plan: 'Self-Insured PPO'  },
  { id: 'pinnacle',  name: 'Pinnacle Industries',     employees: '3,400', plan: 'Self-Insured HDHP' },
  { id: 'coastal',   name: 'Coastal Health Systems',  employees: '850',   plan: 'Level-Funded PPO'  },
]

const STATS = [
  { num: '80%',   label: 'of medical bills contain at least one error' },
  { num: '$428B', label: 'in overcharges absorbed by employers annually' },
  { num: '38%',   label: 'of disputed claims result in a recovery' },
]

const FEATURES = [
  { icon: FileSearch, title: 'AI Claims Audit',      desc: 'Every line item cross-referenced against CMS schedules and NCCI edits' },
  { icon: TrendingUp, title: 'Recovery Scoring',     desc: 'RPS score per claim tells you exactly which disputes are worth filing' },
  { icon: Shield,     title: 'Dispute Generation',   desc: 'Legally precise dispute letters generated and ready to send in seconds' },
]

export default function HomePage() {
  const router = useRouter()
  const [selectedEmployer, setSelectedEmployer] = useState(EMPLOYERS[0])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  // Staged file — set on drop/select, processed only when user clicks Parse button
  const [stagedFile, setStagedFile] = useState<File | null>(null)
  // Two-pass status shown while processing
  const [parseStatus, setParseStatus] = useState<'idle' | 'extracting' | 'classifying'>('idle')

  const processFile = useCallback(async (file: File) => {
    setUploading(true)
    setParseStatus('extracting')
    try {
      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = async (e) => {
          const base64 = (e.target?.result as string).split(',')[1]
          // Small delay so the UI can show "Extracting line items..." before the fetch blocks
          await new Promise(r => setTimeout(r, 100))
          setParseStatus('classifying')
          const res = await fetch('/api/parse-bill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'image', base64, mediaType: file.type, employerId: selectedEmployer.id })
          })
          const { success, data, error } = await res.json()
          if (success && data) {
            sessionStorage.setItem('billback_case', JSON.stringify(data))
            router.push('/dashboard')
          } else {
            alert(`Parse error: ${error}`)
            setUploading(false)
            setParseStatus('idle')
          }
        }
        reader.readAsDataURL(file)
      } else if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        const text = await file.text()
        setParseStatus('classifying')
        const res = await fetch('/api/parse-bill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'text', content: text, employerId: selectedEmployer.id })
        })
        const { success, data, error } = await res.json()
        if (success && data) {
          sessionStorage.setItem('billback_case', JSON.stringify(data))
          router.push('/dashboard')
        } else {
          alert(`Parse error: ${error}`)
          setUploading(false)
          setParseStatus('idle')
        }
      } else {
        alert('Please upload a PDF, image, or CSV file.')
        setUploading(false)
        setParseStatus('idle')
        setStagedFile(null)
      }
    } catch (err) {
      console.error(err)
      alert('Upload failed. Check your API key and try again.')
      setUploading(false)
      setParseStatus('idle')
    }
  }, [selectedEmployer, router])

  const handleDemo = async () => {
    setUploading(true)
    setParseStatus('classifying')
    try {
      const res = await fetch('/api/parse-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'demo', employerId: selectedEmployer.id })
      })
      const { success, data } = await res.json()
      if (success && data) {
        sessionStorage.setItem('billback_case', JSON.stringify(data))
        router.push('/dashboard')
      }
    } catch (err) {
      console.error(err)
      setUploading(false)
      setParseStatus('idle')
    }
  }

  // Stage the file — do NOT process yet
  const stageFile = useCallback((file: File) => {
    setStagedFile(file)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) stageFile(file)
  }, [stageFile])

  return (
    <div className="min-h-screen bg-white flex">

      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex lg:w-[52%] bg-[#F7F9FC] flex-col justify-between p-12 border-r border-gray-100">

        {/* Logo */}
        <div>
          <div className="flex items-center gap-2.5 mb-16">
            <div className="w-8 h-8 bg-[#0F1F3D] rounded-lg flex items-center justify-center">
              <span className="text-[#0ABFBC] text-sm font-black">B</span>
            </div>
            <span className="text-[#0F1F3D] text-lg font-bold tracking-tight">BillBack AI</span>
            <span className="ml-2 text-[10px] font-semibold text-[#0ABFBC] bg-[#0ABFBC]/10 px-2 py-0.5 rounded-full uppercase tracking-wide">Beta</span>
          </div>

          {/* Headline */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-[#0F1F3D] leading-tight tracking-tight mb-4">
             Find and recover the overcharges<br />
              <span className="text-[#0ABFBC]">hidden in your medical bills.</span>
            </h1>
            <p className="text-[#6B82A0] text-base leading-relaxed max-w-sm">
              BillBack audits your medical claims, identifies overcharges, and generates dispute letters automatically, on pure contingency.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-5 mb-12">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Icon className="w-4 h-4 text-[#0F1F3D]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#0F1F3D] mb-0.5">{title}</div>
                  <div className="text-xs text-[#6B82A0] leading-relaxed">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="border-t border-gray-200 pt-8">
          <p className="text-[10px] uppercase tracking-[2px] text-[#6B82A0] font-semibold mb-5">The problem by the numbers</p>
          <div className="grid grid-cols-3 gap-4">
            {STATS.map(({ num, label }) => (
              <div key={num} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="text-2xl font-bold text-[#0F1F3D] mb-1 tracking-tight">{num}</div>
                <div className="text-[11px] text-[#6B82A0] leading-snug">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-7 h-7 bg-[#0F1F3D] rounded-lg flex items-center justify-center">
              <span className="text-[#0ABFBC] text-xs font-black">B</span>
            </div>
            <span className="text-[#0F1F3D] text-base font-bold">BillBack AI</span>
          </div>

          <h2 className="text-2xl font-bold text-[#0F1F3D] mb-1 tracking-tight">Start an audit</h2>
          <p className="text-[#6B82A0] text-sm mb-8">Select an employer account then upload a bill or run a demo.</p>

          {/* Employer selector */}
          <div className="mb-6">
            <label className="text-xs font-semibold text-[#0F1F3D] mb-2.5 block">Employer Account</label>
            <div className="grid grid-cols-3 gap-2">
              {EMPLOYERS.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmployer(emp)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedEmployer.id === emp.id
                      ? 'border-[#0F1F3D] bg-[#0F1F3D]/[0.03]'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className={`text-xs font-semibold truncate mb-0.5 ${selectedEmployer.id === emp.id ? 'text-[#0F1F3D]' : 'text-[#6B82A0]'}`}>
                    {emp.name}
                  </div>
                  <div className="text-[10px] text-[#6B82A0]">{emp.employees} ee</div>
                  {selectedEmployer.id === emp.id && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-[#0ABFBC]" />
                      <span className="text-[10px] text-[#0ABFBC] font-medium">Selected</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Upload area */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-[#0F1F3D] mb-2.5 block">Upload a Bill</label>

            {/* Drop zone — disabled once a file is staged or processing */}
            {!stagedFile && !uploading && (
              <label
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all ${
                  dragging ? 'border-[#0ABFBC] bg-[#0ABFBC]/04' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 bg-white'
                }`}
              >
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.csv,.png,.jpg,.jpeg"
                  onChange={e => { const f = e.target.files?.[0]; if (f) stageFile(f) }}
                />
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Upload className="w-4 h-4 text-[#6B82A0]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-[#0F1F3D] mb-0.5">Drop your bill here or click to browse</p>
                  <p className="text-xs text-[#6B82A0]">PDF, image, or CSV up to 10MB</p>
                </div>
              </label>
            )}

            {/* Staged file — ready to parse */}
            {stagedFile && !uploading && (
              <div className="border-2 border-[#0ABFBC] bg-[#0ABFBC]/[0.04] rounded-xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-[#0ABFBC]/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-[#0ABFBC]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F1F3D] truncate">{stagedFile.name}</p>
                    <p className="text-xs text-[#6B82A0]">{(stagedFile.size / 1024).toFixed(0)} KB · Ready to audit</p>
                  </div>
                  <button
                    onClick={() => setStagedFile(null)}
                    className="text-[#6B82A0] hover:text-[#E53935] text-xs transition-colors flex-shrink-0"
                  >
                    Remove
                  </button>
                </div>
                <button
                  onClick={() => processFile(stagedFile)}
                  className="w-full bg-[#0ABFBC] text-[#0F1F3D] rounded-xl py-3 text-sm font-bold hover:bg-[#07908E] transition-colors flex items-center justify-center gap-2"
                >
                  Parse &amp; Audit Bill
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Processing state with two-pass progress */}
            {uploading && (
              <div className="border-2 border-[#0ABFBC]/40 bg-[#0ABFBC]/[0.04] rounded-xl p-6 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[#0ABFBC]/30 border-t-[#0ABFBC] rounded-full animate-spin" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-[#0F1F3D] mb-0.5">
                    {parseStatus === 'extracting' ? 'Pass 1 — Extracting line items...' : 'Pass 2 — Classifying billing errors...'}
                  </p>
                  <p className="text-xs text-[#6B82A0]">
                    {parseStatus === 'extracting'
                      ? 'Reading CPT codes, amounts, and providers from your document'
                      : 'Applying NCCI edits, AMA guidelines, and commercial rate benchmarks'}
                  </p>
                </div>
                {/* Progress dots */}
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full transition-colors ${parseStatus === 'extracting' ? 'bg-[#0ABFBC]' : 'bg-[#0ABFBC]'}`} />
                  <div className={`w-16 h-0.5 transition-colors ${parseStatus === 'classifying' ? 'bg-[#0ABFBC]' : 'bg-gray-200'}`} />
                  <div className={`w-2 h-2 rounded-full transition-colors ${parseStatus === 'classifying' ? 'bg-[#0ABFBC]' : 'bg-gray-200'}`} />
                </div>
                <div className="flex justify-between w-36 text-[10px] text-[#6B82A0]">
                  <span>Extract</span>
                  <span>Classify</span>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-[#6B82A0] font-medium">or try a demo</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Demo button */}
          <button
            onClick={handleDemo}
            disabled={uploading}
            className="w-full bg-[#0F1F3D] text-white rounded-xl py-3.5 text-sm font-semibold
              hover:bg-[#1A2D5A] disabled:opacity-50 disabled:cursor-not-allowed
              transition-all flex items-center justify-center gap-2.5 group"
          >
            {uploading && parseStatus === 'classifying' && !stagedFile
              ? 'Loading demo...'
              : `Run demo: ${selectedEmployer.name}`}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Trust line */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <Shield className="w-3.5 h-3.5 text-[#6B82A0]" />
            <p className="text-xs text-[#6B82A0]">HIPAA-compliant · Zero upfront cost · Pay only on recovery</p>
          </div>
        </div>
      </div>
    </div>
  )
}
