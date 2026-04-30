'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useMotionValue, useInView, animate } from 'framer-motion'
import { Upload, ArrowRight, FileText, X } from 'lucide-react'
import Logo from '@/components/Logo'
import { HeroSection } from '@/components/HeroSection'

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
}
const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
}

const EMPLOYERS = [
  { id: 'meridian', name: 'Meridian Corp.',        employees: '1,200', plan: 'Self-Insured PPO'  },
  { id: 'pinnacle', name: 'Pinnacle Industries',    employees: '3,400', plan: 'Self-Insured HDHP' },
  { id: 'coastal',  name: 'Coastal Health Systems', employees: '850',   plan: 'Level-Funded PPO'  },
]

const STEPS = [
  { num: '01', title: 'Upload the bill',       desc: 'PDF, image, or CSV. Optionally attach clinical notes for deeper audit.' },
  { num: '02', title: 'AI audits every line',  desc: 'Each CPT code checked against NCCI edits, commercial benchmarks, and E/M guidelines.' },
  { num: '03', title: 'Review flagged errors', desc: 'Overcharges ranked by Recovery Probability Score — highest-confidence disputes first.' },
  { num: '04', title: 'Dispute letters sent',  desc: 'Formally worded letters citing regulatory violations and commercial benchmarks, ready in seconds.' },
]

function StatNumber({ num, label, note }: { num: string; label: string; note?: string }) {
  const ref      = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  const isPercent = num.endsWith('%')
  const isNumeric = isPercent || num.startsWith('$')
  const raw       = num.replace(/[$%,]/g, '')
  const target    = isNumeric ? parseFloat(raw) : 0
  const decimals  = raw.includes('.') ? raw.split('.')[1].length : 0
  const count     = useMotionValue(0)
  const [display, setDisplay] = useState(() =>
    isNumeric ? (isPercent ? '0%' : '$0') : num
  )

  useEffect(() => {
    if (!isInView || !isNumeric) return
    const ctrl = animate(count, target, {
      duration: 1.6,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      onUpdate: v =>
        setDisplay(isPercent
          ? `${v.toFixed(decimals)}%`
          : `$${v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
        ),
    })
    return ctrl.stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInView])

  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      className="flex-1 px-8 py-10 text-center"
    >
      <div className="text-5xl font-bold text-[#0ABFBC] tracking-tight tabular-nums" style={{ fontFamily: 'Georgia, serif' }}>{display}</div>
      <div className="text-[14px] text-[#5A6880] leading-snug mt-3 max-w-[200px] mx-auto">{label}</div>
      {note && <div className="text-[12px] text-[#9BA8B5] mt-1">{note}</div>}
    </motion.div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const [selectedEmployer]                      = useState(EMPLOYERS[0])
  const [dragging, setDragging]                 = useState(false)
  const [uploading, setUploading]               = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [pendingFile, setPendingFile]           = useState<File | null>(null)
  const [previewUrl, setPreviewUrl]             = useState<string | null>(null)
  const [clinicalNotesFile, setClinicalNotesFile] = useState<File | null>(null)

  useEffect(() => {
    const keys = [
      'billback_bill_image', 'billback_clinical_notes_b64',
      'billback_clinical_notes_type', 'billback_parsed_bill',
      'billback_case', 'billback_dispute_claim', 'billback_clinical_notes',
    ]
    keys.forEach(k => sessionStorage.removeItem(k))
  }, [])

  const selectFile = useCallback((file: File) => {
    setPendingFile(file)
    setPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
  }, [])

  const storeClinicalNotes = useCallback((notesFile: File): Promise<void> =>
    new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = e => {
        const dataUrl = e.target?.result as string
        sessionStorage.setItem('billback_clinical_notes_b64', dataUrl.split(',')[1])
        sessionStorage.setItem('billback_clinical_notes_type', notesFile.type)
        resolve()
      }
      reader.readAsDataURL(notesFile)
    }), [])

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
          sessionStorage.setItem('billback_bill_image', dataUrl)
          const res = await fetch('/api/parse-bill', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'parse-only', base64: dataUrl.split(',')[1], mediaType: file.type })
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
    <div className="min-h-screen bg-[#F7F9FC] overflow-x-hidden">

      {/* ── PROCESSING OVERLAY ── */}
      <AnimatePresence>
        {uploading && uploadedFileName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-[#0F1F3D]/85 backdrop-blur-sm flex flex-col items-center justify-center gap-5"
          >
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-white/10" />
              <div className="absolute inset-0 rounded-full border-4 border-t-[#0ABFBC] border-r-transparent border-b-transparent border-l-transparent animate-spin-slow" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-base mb-1">Analysing your bill…</p>
              <p className="text-white/50 text-sm">{uploadedFileName}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 bg-white/90 backdrop-blur-md border-b border-[#E2E8F0]">
        <Logo variant="dark" showBeta />
        <div className="flex items-center gap-3">
          <a href="#how-it-works" className="hidden md:block text-sm text-[#5A6880] hover:text-[#0ABFBC] transition-colors">
            How it works
          </a>
          <a
            href="#audit"
            className="text-sm font-semibold text-white bg-[#0ABFBC] px-5 py-2 rounded-lg hover:bg-[#08A8A5] transition-all duration-200"
          >
            Start Audit
          </a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <HeroSection onDemo={handleDemo} uploading={uploading} />

      {/* ── STATS STRIP ── */}
      <section className="bg-white border-y border-[#E2E8F0]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row">
          {[
            { num: '80%',      label: 'of medical bills contain at least one billing error', note: 'Medical Billing Advocate of America' },
            { num: 'Billions', label: 'in overcharges absorbed by employers annually' },
            { num: '38%',      label: 'of disputed claims result in a recovery' },
          ].map((s, i) => (
            <div key={s.num} className="flex flex-1 items-stretch">
              {i > 0 && <div className="hidden sm:block w-px bg-[#E2E8F0] self-stretch my-6" />}
              {i > 0 && <div className="sm:hidden h-px w-full bg-[#E2E8F0] mx-8" />}
              <StatNumber num={s.num} label={s.label} note={s.note} />
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="bg-[#F7F9FC] py-20 px-6">
        <div className="max-w-5xl mx-auto">

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            className="mb-4"
          >
            <p className="text-[11px] font-semibold text-[#0ABFBC] tracking-[0.08em] uppercase mb-3">The process</p>
            <h2 className="text-2xl font-bold text-[#0F1F3D] tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
              From upload to dispute letter in minutes
            </h2>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
          >
            {STEPS.map(step => (
              <motion.div
                key={step.num}
                variants={fadeUp}
                className="flex items-start gap-6 md:gap-10 border-t border-[#E2E8F0] py-8"
              >
                <span className="text-2xl md:text-3xl font-bold text-[#0ABFBC] tabular-nums leading-none w-10 flex-shrink-0 pt-0.5"
                  style={{ fontFamily: 'Georgia, serif' }}>
                  {step.num}
                </span>
                <div className="flex-1 md:flex md:gap-10">
                  <h3 className="font-semibold text-[17px] text-[#0F1F3D] leading-snug mb-2 md:mb-0 md:w-52 flex-shrink-0">
                    {step.title}
                  </h3>
                  <p className="text-[15px] text-[#5A6880] leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── AUDIT UPLOAD ── */}
      <section id="audit" className="bg-white py-20 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

          {/* Left — context */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            className="lg:pt-2"
          >
            <p className="text-[11px] font-semibold text-[#0ABFBC] tracking-[0.08em] uppercase mb-4">Start auditing</p>
            <h2 className="text-2xl font-bold text-[#0F1F3D] tracking-tight mb-4" style={{ fontFamily: 'Georgia, serif' }}>
              Upload a bill or run the demo
            </h2>
            <p className="text-[15px] text-[#5A6880] leading-[1.75] mb-8">
              Accepts PDF, image, or CSV exports from your TPA or clearinghouse. Clinical notes are optional but improve error detection accuracy.
            </p>

            <div className="space-y-4">
              {[
                { fmt: 'PDF / Image',    desc: 'Scanned EOBs, itemized bills, hospital statements' },
                { fmt: 'CSV',            desc: 'Clearinghouse exports, TPA claim data files' },
                { fmt: 'Clinical Notes', desc: 'Progress notes, op reports — improves E/M audit accuracy' },
              ].map(f => (
                <div key={f.fmt} className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-lg bg-[#F7F9FC] border border-[#E2E8F0] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-[#0ABFBC]" />
                  </div>
                  <div className="pt-2">
                    <span className="text-[14px] font-semibold text-[#0F1F3D]">{f.fmt}</span>
                    <span className="text-[14px] text-[#5A6880]"> — {f.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right — upload form as a card matching the hero preview style */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
          >
            <div className="rounded-xl border border-[#E2E8F0] shadow-[0_4px_24px_rgba(15,31,61,0.08)] overflow-hidden">

              {/* Card header */}
              <div className="bg-[#F8FAFC] border-b border-[#EEF2F7] px-5 py-3.5">
                <p className="text-[11px] text-[#9BA8B5] mb-0.5">Medical bill audit</p>
                <p className="text-[14px] font-semibold text-[#0F1F3D]">Upload your bill to get started</p>
              </div>

              <div className="bg-white p-5">
                {/* Drop zone */}
                <div className="mb-5">
                  <label className="text-[11px] font-semibold text-[#9BA8B5] uppercase tracking-wider mb-2.5 block">
                    Medical Bill
                  </label>
                  <label
                    onDragOver={e => { e.preventDefault(); setDragging(true) }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    className={`flex flex-col items-center justify-center gap-3 border border-dashed rounded-lg p-8 cursor-pointer transition-all duration-200 ${
                      dragging || (uploading && uploadedFileName)
                        ? 'border-[#0ABFBC] bg-[#F0FAFA]'
                        : 'border-[#E2E8F0] hover:border-[#0ABFBC]/50 hover:bg-[#F7F9FC]'
                    }`}
                  >
                    <input
                      type="file" className="hidden"
                      accept=".pdf,.csv,.png,.jpg,.jpeg"
                      onChange={e => { const f = e.target.files?.[0]; if (f) selectFile(f) }}
                    />
                    {previewUrl ? (
                      <img src={previewUrl} alt="Bill preview" className="w-full max-h-36 object-contain rounded" />
                    ) : (
                      <Upload className={`w-5 h-5 ${uploading && uploadedFileName ? 'text-[#0ABFBC]' : 'text-[#C4CBD4]'}`} />
                    )}
                    <div className="text-center">
                      <p className="text-[13px] font-medium text-[#374151]">
                        {uploading && uploadedFileName
                          ? `Processing ${uploadedFileName}…`
                          : pendingFile
                          ? pendingFile.name
                          : 'Drop your bill here or click to browse'}
                      </p>
                      <p className="text-[12px] text-[#9BA8B5] mt-0.5">PDF, image, or CSV · up to 10 MB</p>
                    </div>
                  </label>

                  {pendingFile && !uploading && (
                    <button
                      onClick={() => processFile(pendingFile)}
                      className="w-full mt-3 bg-[#0ABFBC] text-white rounded-lg py-2.5 text-[13px] font-semibold
                        hover:bg-[#08A8A5] transition-colors flex items-center justify-center gap-2 group"
                    >
                      Process Bill
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  )}
                </div>

                {/* Clinical Notes */}
                <div className="mb-5">
                  <label className="text-[11px] font-semibold text-[#9BA8B5] uppercase tracking-wider mb-2.5 flex items-center gap-2">
                    Clinical Notes
                    <span className="text-[11px] font-normal normal-case tracking-normal text-[#C4CBD4]">(optional)</span>
                  </label>
                  {clinicalNotesFile ? (
                    <div className="flex items-center justify-between gap-3 border border-[#0ABFBC]/30 rounded-lg px-4 py-2.5 bg-[#F0FAFA]">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-[#0ABFBC] flex-shrink-0" />
                        <span className="text-[13px] font-medium text-[#374151] truncate">{clinicalNotesFile.name}</span>
                      </div>
                      <button onClick={() => setClinicalNotesFile(null)} className="text-[#C4CBD4] hover:text-[#EF4444] transition-colors flex-shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-3 border border-dashed border-[#E2E8F0] rounded-lg px-4 py-2.5 cursor-pointer hover:border-[#0ABFBC]/50 hover:bg-[#F7F9FC] transition-all duration-200">
                      <input type="file" className="hidden" accept=".txt,.pdf,.md"
                        onChange={e => { const f = e.target.files?.[0]; if (f) setClinicalNotesFile(f) }} />
                      <FileText className="w-3.5 h-3.5 text-[#C4CBD4] flex-shrink-0" />
                      <span className="text-[13px] text-[#9BA8B5]">Attach clinical notes — TXT, PDF, or Markdown</span>
                    </label>
                  )}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-[#F1F5F9]" />
                  <span className="text-[11px] text-[#9BA8B5] font-medium">or try a demo</span>
                  <div className="flex-1 h-px bg-[#F1F5F9]" />
                </div>

                {/* Demo */}
                <button
                  onClick={handleDemo}
                  disabled={uploading}
                  className="w-full bg-white text-[#0F1F3D] text-[13px] font-medium rounded-lg py-2.5
                    border border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]
                    disabled:opacity-40 transition-all flex items-center justify-center gap-2 group"
                >
                  {uploading && !uploadedFileName ? 'Loading demo...' : `Run demo — ${selectedEmployer.name}`}
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* Card footer */}
              <div className="bg-[#F8FAFC] border-t border-[#EEF2F7] px-5 py-2.5">
                <span className="text-[10px] text-[#9BA8B5]">Zero upfront cost · Pay 12% only on recovered overcharges</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-[#E2E8F0] py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo variant="dark" size="sm" />
          <p className="text-[12px] text-[#9BA8B5]">Zero upfront cost · Pay only on recovery</p>
          <p className="text-[12px] text-[#C4CBD4]">© {new Date().getFullYear()} BillBack AI. Beta.</p>
        </div>
      </footer>

    </div>
  )
}
