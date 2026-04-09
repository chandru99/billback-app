'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, ArrowRight, Shield, TrendingUp, FileSearch, FileText, X } from 'lucide-react'

const EMPLOYERS = [
  { id: 'meridian',  name: 'Meridian Corp.',         employees: '1,200', plan: 'Self-Insured PPO'  },
  { id: 'pinnacle',  name: 'Pinnacle Industries',     employees: '3,400', plan: 'Self-Insured HDHP' },
  { id: 'coastal',   name: 'Coastal Health Systems',  employees: '850',   plan: 'Level-Funded PPO'  },
]

const STATS = [
  { num: '80%',               label: 'of medical bills contain at least one error', source: 'Medical Billing Advocate of America' },
  { num: 'Billions',          label: 'in overcharges absorbed by employers annually' },
  { num: '38%',               label: 'of disputed claims result in a recovery' },
]

const FEATURES = [
  { icon: FileSearch, title: 'AI Claims Audit',    desc: 'Every line item cross-referenced against CMS schedules and NCCI edits in seconds.' },
  { icon: TrendingUp, title: 'Recovery Scoring',   desc: 'RPS score per claim tells you exactly which disputes are worth filing.' },
  { icon: Shield,     title: 'Dispute Generation', desc: 'Legally precise dispute letters generated and ready to send automatically.' },
]

function useCountUp(target: number, duration = 1200, active = false) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active) return
    let start: number | null = null
    const step = (ts: number) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      setValue(Math.floor(progress * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [active, target, duration])
  return value
}

function StatCard({ num, label, source, active }: { num: string; label: string; source?: string; active: boolean }) {
  const isPercent = num.endsWith('%')
  const numericTarget = isPercent ? parseInt(num) : 38
  const count = useCountUp(numericTarget, 1400, active && (isPercent))

  return (
    <div className="flex flex-col items-center text-center px-8 py-6 group">
      <div className="text-5xl font-bold text-[#0F1F3D] tracking-tight mb-2 tabular-nums">
        {isPercent ? `${count}%` : num}
      </div>
      <div className="text-sm text-[#6B82A0] leading-snug max-w-[160px]">{label}</div>
      {source && <div className="text-[10px] text-[#9BAABB] mt-1.5">(Source: {source})</div>}
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const [selectedEmployer] = useState(EMPLOYERS[0])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [clinicalNotesFile, setClinicalNotesFile] = useState<File | null>(null)
  const [statsVisible, setStatsVisible] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)

  // Clear all previous session data when landing on the home page
  useEffect(() => {
    const keys = [
      'billback_bill_image',
      'billback_clinical_notes_b64',
      'billback_clinical_notes_type',
      'billback_parsed_bill',
      'billback_case',
      'billback_dispute_claim',
      'billback_clinical_notes',
    ]
    keys.forEach(k => sessionStorage.removeItem(k))
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true) },
      { threshold: 0.3 }
    )
    if (statsRef.current) observer.observe(statsRef.current)
    return () => observer.disconnect()
  }, [])

  const selectFile = useCallback((file: File) => {
    setPendingFile(file)
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file))
    } else {
      setPreviewUrl(null)
    }
  }, [])

  const storeClinicalNotes = useCallback((notesFile: File): Promise<void> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        const base64 = dataUrl.split(',')[1]
        sessionStorage.setItem('billback_clinical_notes_b64', base64)
        sessionStorage.setItem('billback_clinical_notes_type', notesFile.type)
        resolve()
      }
      reader.readAsDataURL(notesFile)
    })
  }, [])

  const processFile = useCallback(async (file: File) => {
    setUploading(true)
    setUploadedFileName(file.name)
    try {
      if (clinicalNotesFile) await storeClinicalNotes(clinicalNotesFile)
      else {
        sessionStorage.removeItem('billback_clinical_notes_b64')
        sessionStorage.removeItem('billback_clinical_notes_type')
      }

      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = async (e) => {
          const dataUrl = e.target?.result as string
          const base64 = dataUrl.split(',')[1]
          sessionStorage.setItem('billback_bill_image', dataUrl)
          const res = await fetch('/api/parse-bill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'parse-only', base64, mediaType: file.type })
          })
          const { success, data, error } = await res.json()
          if (success && data) {
            sessionStorage.setItem('billback_parsed_bill', JSON.stringify(data))
            router.push('/review')
          } else {
            alert(`Parse error: ${error}`)
            setUploading(false)
            setUploadedFileName('')
          }
        }
        reader.readAsDataURL(file)
      } else if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        sessionStorage.removeItem('billback_bill_image')
        const text = await file.text()
        const res = await fetch('/api/parse-bill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'parse-only-text', content: text })
        })
        const { success, data, error } = await res.json()
        if (success && data) {
          sessionStorage.setItem('billback_parsed_bill', JSON.stringify(data))
          router.push('/review')
        } else {
          alert(`Parse error: ${error}`)
          setUploading(false)
          setUploadedFileName('')
        }
      } else {
        alert('Please upload a PDF, image, or CSV file.')
        setUploading(false)
        setUploadedFileName('')
      }
    } catch (err) {
      console.error(err)
      alert('Upload failed. Check your API key and try again.')
      setUploading(false)
      setUploadedFileName('')
    }
  }, [router, clinicalNotesFile, storeClinicalNotes])

  const handleDemo = async () => {
    setUploading(true)
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
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) selectFile(file)
  }, [selectFile])

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#0F1F3D] rounded-lg flex items-center justify-center">
            <span className="text-[#0ABFBC] text-xs font-black">B</span>
          </div>
          <span className="text-[#0F1F3D] text-base font-bold tracking-tight">BillBack AI</span>
          <span className="ml-1 text-[10px] font-semibold text-[#0ABFBC] bg-[#0ABFBC]/10 px-2 py-0.5 rounded-full uppercase tracking-wide">Beta</span>
        </div>
        <a
          href="#audit"
          className="text-sm font-semibold text-white bg-[#0F1F3D] px-5 py-2 rounded-full hover:bg-[#1A2D5A] transition-all duration-200"
        >
          Start Audit
        </a>
      </nav>

      {/* ── HERO ── */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-28 pb-20 overflow-hidden bg-[#0F1F3D]">
        {/* Mesh gradient background */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(10,191,188,0.18) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(10,191,188,0.10) 0%, transparent 60%)'
        }} />

        <div className="relative z-10 max-w-3xl mx-auto animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0ABFBC] animate-pulse" />
            <span className="text-xs text-white/70 font-medium tracking-wide">AI-powered medical bill auditing</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight tracking-tight mb-6">
            Find and recover the<br />
            <span className="text-[#0ABFBC]">overcharges hidden</span><br />
            in your medical bills.
          </h1>

          <p className="text-lg text-white/60 leading-relaxed max-w-xl mx-auto mb-10">
            BillBack audits your claims, identifies overcharges, and generates dispute letters — automatically, on pure contingency.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#audit"
              className="flex items-center gap-2 bg-[#0ABFBC] text-white font-semibold px-7 py-3.5 rounded-full hover:bg-[#09ADAA] transition-all duration-200 hover:scale-[1.02] shadow-lg shadow-[#0ABFBC]/30 group"
            >
              Start an audit
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
            <a
              href="#features"
              className="flex items-center gap-2 text-white/70 font-medium px-7 py-3.5 rounded-full border border-white/20 hover:border-white/40 hover:text-white transition-all duration-200"
            >
              How it works
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-40">
          <span className="text-[10px] text-white uppercase tracking-widest">Scroll</span>
          <div className="w-px h-8 bg-white/40" />
        </div>
      </section>

      {/* ── STATS ── */}
      <section ref={statsRef} className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-[10px] uppercase tracking-[3px] text-[#9BAABB] font-semibold pt-12 mb-2">The problem by the numbers</p>
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            {STATS.map(({ num, label, source }) => (
              <StatCard key={num} num={num} label={label} source={source} active={statsVisible} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="bg-[#F7F9FC] py-14 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-[10px] uppercase tracking-[3px] text-[#9BAABB] font-semibold mb-3">How it works</p>
          <h2 className="text-3xl font-bold text-[#0F1F3D] text-center tracking-tight mb-10">Three steps to recovery</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <div
                key={title}
                className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-default"
              >
                <div className="w-11 h-11 rounded-2xl bg-[#0F1F3D]/[0.05] flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-[#0F1F3D]" />
                </div>
                <div className="text-xs font-semibold text-[#0ABFBC] mb-1 uppercase tracking-wide">Step {i + 1}</div>
                <div className="text-base font-bold text-[#0F1F3D] mb-2">{title}</div>
                <div className="text-sm text-[#6B82A0] leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AUDIT PANEL ── */}
      <section id="audit" className="bg-white py-14 px-6">
        <div className="max-w-lg mx-auto">
          <p className="text-center text-[10px] uppercase tracking-[3px] text-[#9BAABB] font-semibold mb-3">Get started</p>
          <h2 className="text-3xl font-bold text-[#0F1F3D] text-center tracking-tight mb-2">Start an audit</h2>
          <p className="text-center text-sm text-[#6B82A0] mb-10">Upload a bill or run a demo to get started.</p>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-xl shadow-gray-100/80 p-8">

            {/* Upload area */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-[#0F1F3D] mb-2.5 block">Upload a Bill</label>
              <label
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all duration-200 ${
                  dragging
                    ? 'border-[#0ABFBC] bg-[#0ABFBC]/[0.04]'
                    : uploading && uploadedFileName
                    ? 'border-[#0ABFBC] bg-[#0ABFBC]/[0.04]'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 bg-white'
                }`}
              >
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.csv,.png,.jpg,.jpeg"
                  onChange={e => { const f = e.target.files?.[0]; if (f) selectFile(f) }}
                />
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Bill preview"
                    className="w-full max-h-48 object-contain rounded-lg"
                  />
                ) : (
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${uploading && uploadedFileName ? 'bg-[#0ABFBC]/10' : 'bg-gray-100'}`}>
                    <Upload className={`w-4 h-4 ${uploading && uploadedFileName ? 'text-[#0ABFBC]' : 'text-[#6B82A0]'}`} />
                  </div>
                )}
                <div className="text-center">
                  <p className="text-sm font-semibold text-[#0F1F3D] mb-0.5">
                    {uploading && uploadedFileName
                      ? `Processing ${uploadedFileName}...`
                      : pendingFile
                      ? pendingFile.name
                      : 'Drop your bill here or click to browse'}
                  </p>
                  <p className="text-xs text-[#6B82A0]">PDF, image, or CSV up to 10MB</p>
                </div>
              </label>

              {pendingFile && !uploading && (
                <button
                  onClick={() => processFile(pendingFile)}
                  className="w-full mt-3 bg-[#0ABFBC] text-white rounded-xl py-3.5 text-sm font-semibold
                    hover:bg-[#09ADAA] hover:scale-[1.01] transition-all duration-200 flex items-center justify-center gap-2.5 group shadow-md shadow-[#0ABFBC]/20"
                >
                  Process Bill
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}
            </div>

            {/* Clinical Notes Upload */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-[#0F1F3D] mb-1 block">
                Clinical Notes
                <span className="ml-1.5 text-[10px] font-normal text-[#9BAABB]">Optional — improves error detection</span>
              </label>
              {clinicalNotesFile ? (
                <div className="flex items-center justify-between gap-3 border border-[#0ABFBC]/40 bg-[#0ABFBC]/[0.04] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-[#0ABFBC] flex-shrink-0" />
                    <span className="text-xs font-medium text-[#0F1F3D] truncate">{clinicalNotesFile.name}</span>
                  </div>
                  <button
                    onClick={() => setClinicalNotesFile(null)}
                    className="text-[#9BAABB] hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-3 border border-dashed border-gray-200 rounded-xl px-4 py-3 cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-all duration-200">
                  <input
                    type="file"
                    className="hidden"
                    accept=".txt,.pdf,.md"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setClinicalNotesFile(f) }}
                  />
                  <FileText className="w-4 h-4 text-[#9BAABB] flex-shrink-0" />
                  <span className="text-xs text-[#6B82A0]">Upload clinical notes — TXT, PDF, or Markdown</span>
                </label>
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
                hover:bg-[#1A2D5A] hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200 flex items-center justify-center gap-2.5 group"
            >
              {uploading && !uploadedFileName
                ? 'Loading demo...'
                : `Run demo: ${selectedEmployer.name}`}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#F7F9FC] border-t border-gray-100 py-8 px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-5 h-5 bg-[#0F1F3D] rounded-md flex items-center justify-center">
            <span className="text-[#0ABFBC] text-[9px] font-black">B</span>
          </div>
          <span className="text-sm font-bold text-[#0F1F3D]">BillBack AI</span>
        </div>
        <p className="text-xs text-[#9BAABB]">Zero upfront cost · Pay only on recovery</p>
      </footer>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.8s ease-out both;
        }
      `}</style>
    </div>
  )
}
