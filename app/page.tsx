'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, ArrowRight, FileText, X, CheckCircle, AlertTriangle } from 'lucide-react'
import Logo from '@/components/Logo'

function useCountUp(target: number, duration = 1400, active = false, decimals = 0) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active) return
    let start: number | null = null
    const step = (ts: number) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setValue(parseFloat((ease * target).toFixed(decimals)))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [active, target, duration, decimals])
  return value
}

function StatNumber({ num, label, note, active }: { num: string; label: string; note?: string; active: boolean }) {
  const isPercent = num.endsWith('%')
  const isNumeric = isPercent || num.startsWith('$')
  const raw       = num.replace(/[$%,]/g, '')
  const target    = isNumeric ? parseFloat(raw) : 0
  const decimals  = raw.includes('.') ? raw.split('.')[1].length : 0
  const count     = useCountUp(target, 1400, active && isNumeric, decimals)

  const display = !isNumeric
    ? num
    : isPercent
    ? `${count.toFixed(decimals)}%`
    : `$${count.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`

  return (
    <div className="px-8 py-7 text-center">
      <div className="font-display text-6xl font-black text-[#0ABFBC] mb-2 tabular-nums tracking-tight">{display}</div>
      <div className="text-sm text-[#6B82A0] leading-snug">{label}</div>
      {note && <div className="text-xs text-[#9BAABB] mt-1">{note}</div>}
    </div>
  )
}

const EMPLOYERS = [
  { id: 'meridian',  name: 'Meridian Corp.',         employees: '1,200', plan: 'Self-Insured PPO'  },
  { id: 'pinnacle',  name: 'Pinnacle Industries',     employees: '3,400', plan: 'Self-Insured HDHP' },
  { id: 'coastal',   name: 'Coastal Health Systems',  employees: '850',   plan: 'Level-Funded PPO'  },
]

const ERROR_TYPES = [
  {
    label: 'Upcoding',
    color: '#F97316',
    bg: 'bg-orange-50',
    border: 'border-orange-100',
    dot: 'bg-orange-400',
    example: 'CPT 99215 billed — documentation supports 99213',
    recovery: '$214 recovered',
  },
  {
    label: 'Duplicate Charge',
    color: '#E53935',
    bg: 'bg-red-50',
    border: 'border-red-100',
    dot: 'bg-red-400',
    example: 'CPT 36415 billed twice on same date of service',
    recovery: '$45 recovered',
  },
  {
    label: 'Unbundling',
    color: '#7C3AED',
    bg: 'bg-purple-50',
    border: 'border-purple-100',
    dot: 'bg-purple-400',
    example: 'CPT 94010 billed separately — included in CPT 94060',
    recovery: '$95 recovered',
  },
  {
    label: 'Fee Schedule Violation',
    color: '#B45309',
    bg: 'bg-yellow-50',
    border: 'border-yellow-100',
    dot: 'bg-yellow-500',
    example: 'Billed $580 — 80th pctl commercial rate is $210',
    recovery: '$370 recovered',
  },
]

const STEPS = [
  { num: '01', title: 'Upload the bill', desc: 'PDF, image, or CSV. Optionally attach clinical notes for deeper audit.' },
  { num: '02', title: 'AI audits every line', desc: 'Each CPT code checked against NCCI edits, commercial benchmarks, and E/M guidelines.' },
  { num: '03', title: 'Review flagged errors', desc: 'Overcharges ranked by Recovery Probability Score — highest-confidence disputes first.' },
  { num: '04', title: 'Dispute letters sent', desc: 'Formally worded letters citing specific regulatory violations and commercial benchmarks, ready in seconds.' },
]


export default function HomePage() {
  const router = useRouter()
  const [selectedEmployer] = useState(EMPLOYERS[0])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [clinicalNotesFile, setClinicalNotesFile] = useState<File | null>(null)
  const [activeError, setActiveError] = useState(0)
  const [statsVisible, setStatsVisible] = useState(false)
  const [stepsVisible, setStepsVisible] = useState(false)
  const statsRef = useRef<HTMLElement>(null)
  const stepsRef = useRef<HTMLElement>(null)
  const rotateRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const keys = [
      'billback_bill_image', 'billback_clinical_notes_b64',
      'billback_clinical_notes_type', 'billback_parsed_bill',
      'billback_case', 'billback_dispute_claim', 'billback_clinical_notes',
    ]
    keys.forEach(k => sessionStorage.removeItem(k))
  }, [])

  // Auto-rotate error type pills
  useEffect(() => {
    rotateRef.current = setInterval(() => {
      setActiveError(p => (p + 1) % ERROR_TYPES.length)
    }, 2400)
    return () => { if (rotateRef.current) clearInterval(rotateRef.current) }
  }, [])

  // Trigger stat count-up on scroll into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true) },
      { threshold: 0.3 }
    )
    if (statsRef.current) observer.observe(statsRef.current)
    return () => observer.disconnect()
  }, [])

  // Trigger steps animation on scroll into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStepsVisible(true) },
      { threshold: 0.2 }
    )
    if (stepsRef.current) observer.observe(stepsRef.current)
    return () => observer.disconnect()
  }, [])

  const selectFile = useCallback((file: File) => {
    setPendingFile(file)
    setPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
  }, [])

  const storeClinicalNotes = useCallback((notesFile: File): Promise<void> => {
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = e => {
        const dataUrl = e.target?.result as string
        sessionStorage.setItem('billback_clinical_notes_b64', dataUrl.split(',')[1])
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
        reader.onload = async e => {
          const dataUrl = e.target?.result as string
          const base64 = dataUrl.split(',')[1]
          sessionStorage.setItem('billback_bill_image', dataUrl)
          const res = await fetch('/api/parse-bill', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'parse-only', base64, mediaType: file.type })
          })
          const { success, data, error } = await res.json()
          if (success && data) {
            sessionStorage.setItem('billback_parsed_bill', JSON.stringify(data))
            router.push('/review')
          } else {
            alert(`Parse error: ${error}`)
            setUploading(false); setUploadedFileName('')
          }
        }
        reader.readAsDataURL(file)
      } else if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        sessionStorage.removeItem('billback_bill_image')
        const text = await file.text()
        const res = await fetch('/api/parse-bill', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'parse-only-text', content: text })
        })
        const { success, data, error } = await res.json()
        if (success && data) {
          sessionStorage.setItem('billback_parsed_bill', JSON.stringify(data))
          router.push('/review')
        } else {
          alert(`Parse error: ${error}`)
          setUploading(false); setUploadedFileName('')
        }
      } else {
        alert('Please upload a PDF, image, or CSV file.')
        setUploading(false); setUploadedFileName('')
      }
    } catch (err) {
      console.error(err)
      alert('Upload failed. Check your API key and try again.')
      setUploading(false); setUploadedFileName('')
    }
  }, [router, clinicalNotesFile, storeClinicalNotes])

  const handleDemo = async () => {
    setUploading(true)
    try {
      const res = await fetch('/api/parse-bill', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) selectFile(file)
  }, [selectFile])

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── PROCESSING OVERLAY ── */}
      {uploading && uploadedFileName && (
        <div className="fixed inset-0 z-[100] bg-[#0A1628]/80 backdrop-blur-sm flex flex-col items-center justify-center gap-5">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-white/10" />
            <div className="absolute inset-0 rounded-full border-4 border-t-[#0ABFBC] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-white font-semibold text-base mb-1">Analysing your bill…</p>
            <p className="text-white/40 text-sm">{uploadedFileName}</p>
          </div>
        </div>
      )}

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 bg-[#0A1628]/90 backdrop-blur-md border-b border-white/[0.06]">
        <Logo variant="light" showBeta />
        <div className="flex items-center gap-3">
          <a href="#how-it-works" className="hidden md:block text-sm text-white/50 hover:text-white transition-colors">How it works</a>
          <a
            href="#audit"
            className="text-sm font-semibold text-[#0F1F3D] bg-[#0ABFBC] px-5 py-2 rounded-full hover:bg-[#09ADAA] transition-all duration-200"
          >
            Start Audit
          </a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative bg-[#0A1628] pt-28 pb-16 md:pb-24 px-6 overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(#0ABFBC 1px, transparent 1px), linear-gradient(90deg, #0ABFBC 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        {/* Radial glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(10,191,188,0.15) 0%, transparent 65%)' }} />

        <div className="relative z-10 max-w-3xl mx-auto text-center">

          {/* Error type pills rotating */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
              {ERROR_TYPES.map((e, i) => (
                <button
                  key={e.label}
                  onClick={() => { setActiveError(i); if (rotateRef.current) clearInterval(rotateRef.current) }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-semibold transition-all duration-300"
                  style={{
                    borderColor: i === activeError ? e.color : 'rgba(255,255,255,0.08)',
                    color: i === activeError ? e.color : 'rgba(255,255,255,0.3)',
                    background: i === activeError ? `${e.color}12` : 'transparent',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: i === activeError ? e.color : 'rgba(255,255,255,0.15)' }} />
                  {e.label}
                </button>
              ))}
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-[1.15] tracking-tight mb-5">
              Your medical bills<br />
              are <span className="text-[#0ABFBC]">overcharging you.</span><br />
              We find the proof.
            </h1>

            <p className="text-base text-white/50 leading-relaxed mb-6 max-w-md mx-auto">
              BillBack audits every CPT code against NCCI edits, commercial benchmarks, and E/M guidelines — then generates the dispute letter automatically.
            </p>

            {/* Animated error example */}
            <div className="mb-8 p-4 rounded-xl border border-white/[0.07] bg-white/[0.03] transition-all duration-500 text-left max-w-xl mx-auto">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ERROR_TYPES[activeError].color }} />
                    <span className="text-xs font-bold" style={{ color: ERROR_TYPES[activeError].color }}>
                      {ERROR_TYPES[activeError].label} detected
                    </span>
                  </div>
                  <p className="text-sm text-white/60">{ERROR_TYPES[activeError].example}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="flex items-center gap-1 text-[#00BFA5]">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">{ERROR_TYPES[activeError].recovery}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="#audit"
                className="flex items-center gap-2 bg-[#0ABFBC] text-[#0F1F3D] font-bold px-6 py-3 rounded-full hover:bg-[#09ADAA] transition-all duration-200 shadow-lg shadow-[#0ABFBC]/20 group"
              >
                Upload a bill
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
              <button
                onClick={handleDemo}
                disabled={uploading}
                className="flex items-center gap-2 text-white/60 font-medium px-6 py-3 rounded-full border border-white/10 hover:border-white/25 hover:text-white transition-all duration-200 disabled:opacity-40"
              >
                {uploading && !uploadedFileName ? 'Loading...' : 'Run demo audit'}
              </button>
            </div>

            <p className="mt-4 text-[11px] text-white/25">Zero upfront cost · Pay only on recovery</p>
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      <section ref={statsRef} className="bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto grid grid-cols-3">
          {[
            { num: '80%',      label: 'of medical bills contain at least one billing error', note: 'Medical Billing Advocate of America' },
            { num: 'Billions', label: 'in overcharges absorbed by employers annually' },
            { num: '38%',      label: 'of disputed claims result in a recovery' },
          ].map(s => (
            <StatNumber key={s.num} num={s.num} label={s.label} note={s.note} active={statsVisible} />
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section ref={stepsRef} id="how-it-works" className="bg-white py-16 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto">

          {/* Animated header */}
          <div
            className="mb-10 transition-all duration-700"
            style={{
              opacity:   stepsVisible ? 1 : 0,
              transform: stepsVisible ? 'translateY(0)' : 'translateY(20px)',
            }}
          >
            <p className="text-[10px] uppercase tracking-[3px] text-[#9BAABB] font-semibold mb-2">The process</p>
            <h2 className="text-2xl font-bold text-[#0F1F3D] tracking-tight">From upload to dispute letter in minutes</h2>
          </div>

          <div className="relative">

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {STEPS.map((step, i) => (
                <div
                  key={step.num}
                  className="relative transition-all duration-700"
                  style={{
                    opacity:         stepsVisible ? 1 : 0,
                    transform:       stepsVisible ? 'translateY(0)' : 'translateY(36px)',
                    transitionDelay: `${i * 180}ms`,
                  }}
                >
                  {/* Icon sits on top of the line */}
                  <div
                    className="relative z-10 w-10 h-10 rounded-xl bg-[#0F1F3D] flex items-center justify-center mb-5 transition-all duration-700"
                    style={{
                      boxShadow:       stepsVisible ? '0 0 0 7px rgba(10,191,188,0.13)' : '0 0 0 0px rgba(10,191,188,0)',
                      transitionDelay: `${i * 180 + 200}ms`,
                    }}
                  >
                    <span className="text-[#0ABFBC] text-xs font-black">{step.num}</span>
                  </div>

                  <h3 className="font-display text-xl font-black text-[#0F1F3D] mb-2 tracking-tight leading-snug">{step.title}</h3>
                  <p className="text-sm text-[#6B82A0] leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── AUDIT PANEL ── */}
      <section id="audit" className="bg-[#F7F9FC] py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

          {/* Left — context */}
          <div className="lg:pt-4">
            <p className="text-[10px] uppercase tracking-[3px] text-[#9BAABB] font-semibold mb-3">Start auditing</p>
            <h2 className="text-2xl font-bold text-[#0F1F3D] tracking-tight mb-4">Upload a bill or run the demo</h2>
            <p className="text-sm text-[#6B82A0] leading-relaxed mb-6">
              Accepts PDF, image, or CSV exports from your TPA or clearinghouse. Clinical notes are optional but improve error detection accuracy.
            </p>

            {/* Accepted formats */}
            <div className="space-y-2.5">
              {[
                { fmt: 'PDF / Image', desc: 'Scanned EOBs, itemized bills, hospital statements' },
                { fmt: 'CSV',         desc: 'Clearinghouse exports, TPA claim data files' },
                { fmt: 'Clinical Notes', desc: 'Progress notes, op reports — improves E/M audit accuracy' },
              ].map(f => (
                <div key={f.fmt} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0ABFBC] mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-[#0F1F3D]">{f.fmt} </span>
                    <span className="text-xs text-[#6B82A0]">— {f.desc}</span>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* Right — upload form */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

            {/* Drop zone */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-[#0F1F3D] mb-2 block">Medical Bill</label>
              <label
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all duration-200 ${
                  dragging ? 'border-[#0ABFBC] bg-[#0ABFBC]/[0.04]'
                  : uploading && uploadedFileName ? 'border-[#0ABFBC] bg-[#0ABFBC]/[0.04]'
                  : 'border-gray-200 hover:border-gray-300 bg-gray-50/60 hover:bg-gray-50'
                }`}
              >
                <input
                  type="file" className="hidden"
                  accept=".pdf,.csv,.png,.jpg,.jpeg"
                  onChange={e => { const f = e.target.files?.[0]; if (f) selectFile(f) }}
                />
                {previewUrl ? (
                  <img src={previewUrl} alt="Bill preview" className="w-full max-h-40 object-contain rounded-lg" />
                ) : (
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${uploading && uploadedFileName ? 'bg-[#0ABFBC]/10' : 'bg-white border border-gray-200'}`}>
                    <Upload className={`w-4 h-4 ${uploading && uploadedFileName ? 'text-[#0ABFBC]' : 'text-[#9BAABB]'}`} />
                  </div>
                )}
                <div className="text-center">
                  <p className="text-sm font-semibold text-[#0F1F3D] mb-0.5">
                    {uploading && uploadedFileName ? `Processing ${uploadedFileName}...`
                      : pendingFile ? pendingFile.name
                      : 'Drop your bill here or click to browse'}
                  </p>
                  <p className="text-xs text-[#9BAABB]">PDF, image, or CSV · up to 10 MB</p>
                </div>
              </label>

              {pendingFile && !uploading && (
                <button
                  onClick={() => processFile(pendingFile)}
                  className="w-full mt-3 bg-[#0ABFBC] text-[#0F1F3D] rounded-xl py-3 text-sm font-bold
                    hover:bg-[#09ADAA] transition-all duration-200 flex items-center justify-center gap-2 group"
                >
                  Process Bill
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}
            </div>

            {/* Clinical Notes */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-[#0F1F3D] mb-1.5 flex items-center gap-1.5 block">
                Clinical Notes
                <span className="text-[10px] font-normal text-[#9BAABB] bg-gray-100 px-2 py-0.5 rounded-full">Optional</span>
              </label>
              {clinicalNotesFile ? (
                <div className="flex items-center justify-between gap-3 border border-[#0ABFBC]/30 bg-[#0ABFBC]/[0.04] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-[#0ABFBC] flex-shrink-0" />
                    <span className="text-xs font-medium text-[#0F1F3D] truncate">{clinicalNotesFile.name}</span>
                  </div>
                  <button onClick={() => setClinicalNotesFile(null)} className="text-[#9BAABB] hover:text-red-400 transition-colors flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-3 border border-dashed border-gray-200 rounded-xl px-4 py-3 cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-all duration-200">
                  <input type="file" className="hidden" accept=".txt,.pdf,.md"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setClinicalNotesFile(f) }} />
                  <FileText className="w-3.5 h-3.5 text-[#9BAABB] flex-shrink-0" />
                  <span className="text-xs text-[#9BAABB]">Attach clinical notes — TXT, PDF, or Markdown</span>
                </label>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-[#9BAABB] font-medium">or try a demo</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Demo */}
            <button
              onClick={handleDemo}
              disabled={uploading}
              className="w-full bg-[#0F1F3D] text-white rounded-xl py-3 text-sm font-semibold
                hover:bg-[#1A2D5A] disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200 flex items-center justify-center gap-2 group"
            >
              {uploading && !uploadedFileName ? 'Loading demo...' : `Run demo — ${selectedEmployer.name}`}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0A1628] border-t border-white/[0.06] py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo variant="light" size="sm" />
          <p className="text-xs text-white/25">Zero upfront cost · Pay only on recovery</p>
          <p className="text-xs text-white/20">© {new Date().getFullYear()} BillBack AI. Beta.</p>
        </div>
      </footer>
    </div>
  )
}
