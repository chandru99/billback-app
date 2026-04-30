'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Search, BarChart2, FileText } from 'lucide-react'

const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
}

const AUDIT_ROWS = [
  { cpt: '36415', desc: 'Venipuncture',            status: 'error', error: 'Duplicate',    rps: 93, rpsColor: '#10B981' },
  { cpt: '85025', desc: 'CBC with differential',   status: 'error', error: 'Fee schedule', rps: 71, rpsColor: '#10B981' },
  { cpt: '94010', desc: 'Spirometry',              status: 'error', error: 'Unbundling',   rps: 58, rpsColor: '#F59E0B' },
  { cpt: '99213', desc: 'Office visit – Level 3',  status: 'clean', error: null,           rps: null, rpsColor: '' },
  { cpt: '99215', desc: 'Office visit – Level 5',  status: 'error', error: 'Upcoding',     rps: 38, rpsColor: '#EF4444' },
]

const FEATURES = [
  {
    icon: Search,
    title: 'AI Claims Audit',
    desc:  'Every line item cross-referenced against CMS schedules and NCCI edits',
  },
  {
    icon: BarChart2,
    title: 'Recovery Scoring',
    desc:  'RPS score per claim tells you exactly which disputes are worth filing',
  },
  {
    icon: FileText,
    title: 'Dispute Generation',
    desc:  'Legally precise dispute letters generated and ready to send in seconds',
  },
]

export function HeroSection({
  onDemo,
  uploading,
}: {
  onDemo: () => void
  uploading: boolean
}) {
  const [activeRow, setActiveRow] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setActiveRow(p => (p + 1) % AUDIT_ROWS.length), 2200)
    return () => clearInterval(t)
  }, [])

  return (
    <section className="bg-[#F7F9FC] pt-28 pb-20 px-6 md:px-10">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

        {/* ── LEFT: Copy ── */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.p
            variants={fadeUp}
            className="text-[11px] font-semibold text-[#0ABFBC] tracking-[0.08em] uppercase mb-4"
          >
            AI-powered billing audit
          </motion.p>

          <motion.h1
            variants={fadeUp}
            className="text-4xl md:text-[42px] font-bold text-[#0F1F3D] leading-[1.12] tracking-tight mb-5"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            Find and recover<br />
            <span className="text-[#0ABFBC]">overcharges hidden</span><br />
            in your medical bills.
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-[15px] text-[#5A6880] leading-[1.75] mb-8 max-w-md"
          >
            BillBack audits every claim, identifies billing errors, and generates
            regulation-cited dispute letters automatically — on pure contingency.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col gap-5 mb-9">
            {FEATURES.map(f => (
              <div key={f.title} className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-4 h-4 text-[#0ABFBC]" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#0F1F3D] mb-0.5">{f.title}</p>
                  <p className="text-[13px] text-[#6B7E8F] leading-snug">{f.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>

          <motion.div variants={fadeUp} className="flex justify-center gap-3 mb-3">
            <a
              href="#audit"
              className="inline-flex items-center gap-2 bg-[#0ABFBC] text-white text-[13px] font-semibold
                px-5 py-2.5 rounded-lg hover:bg-[#08A8A5] transition-colors group"
            >
              Upload a bill
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </a>
            <button
              onClick={onDemo}
              disabled={uploading}
              className="inline-flex items-center gap-2 bg-white text-[#0F1F3D] text-[13px] font-medium
                px-5 py-2.5 rounded-lg border border-[#E2E8F0] hover:border-[#CBD5E1]
                hover:bg-[#F8FAFC] transition-all disabled:opacity-40"
            >
              {uploading ? 'Loading...' : 'Run demo audit'}
            </button>
          </motion.div>

          <motion.p variants={fadeUp} className="text-[11px] text-[#9BA8B5] text-center">
            Zero upfront cost · Pay 12% only on recovered overcharges
          </motion.p>
        </motion.div>

        {/* ── RIGHT: Product preview ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="hidden lg:block"
        >
          <div className="rounded-xl overflow-hidden border border-[#E2E8F0] shadow-[0_4px_24px_rgba(15,31,61,0.08)]">

            {/* Title bar */}
            <div className="bg-[#F8FAFC] border-b border-[#EEF2F7] px-4 py-2.5 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
              </div>
              <div className="flex-1 bg-[#EEF2F7] rounded px-3 py-1 text-[10px] text-[#9BA8B5] font-mono">
                billback.ai/audit/results
              </div>
            </div>

            {/* Dashboard header */}
            <div className="bg-white border-b border-[#EEF2F7] px-5 py-3.5 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-[#9BA8B5] mb-0.5">Claim audit — Meridian Corp.</p>
                <p className="text-[14px] font-semibold text-[#0F1F3D]">3 errors detected</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-[#9BA8B5] mb-0.5">Recoverable</p>
                <p className="text-[17px] font-bold text-[#0ABFBC]">$724 est.</p>
              </div>
            </div>

            {/* Table header */}
            <div className="bg-[#F8FAFC] border-b border-[#EEF2F7] px-5 py-2 grid grid-cols-[60px_1fr_110px_65px] gap-2">
              {['CPT', 'Description', 'Error', 'RPS'].map(h => (
                <span key={h} className="text-[9px] font-semibold text-[#9BA8B5] uppercase tracking-wider">{h}</span>
              ))}
            </div>

            {/* Table rows */}
            <div className="bg-white">
              {AUDIT_ROWS.map((row, i) => (
                <motion.div
                  key={row.cpt}
                  animate={{ backgroundColor: i === activeRow ? '#F0FAFA' : '#FFFFFF' }}
                  transition={{ duration: 0.3 }}
                  className="px-5 py-2.5 grid grid-cols-[60px_1fr_110px_65px] gap-2 items-center border-b border-[#F1F5F9]"
                >
                  <span className="font-mono text-[11px] text-[#6B7E8F]">{row.cpt}</span>
                  <span className="text-[12px] text-[#374151] truncate">{row.desc}</span>
                  <div>
                    {row.error ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full text-[#DC2626] bg-[#FEF2F2]">
                        ▲ {row.error}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full text-[#059669] bg-[#ECFDF5]">
                        ✓ Clean
                      </span>
                    )}
                  </div>
                  <div>
                    {row.rps ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-10 h-1 rounded-full bg-[#E5E7EB] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${row.rps}%`, background: row.rpsColor }}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-[#9BA8B5]">{row.rps}%</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#C4CBD4] pl-1">—</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Footer */}
            <div className="bg-[#F8FAFC] border-t border-[#EEF2F7] px-5 py-2.5 flex items-center justify-between">
              <span className="text-[10px] text-[#9BA8B5]">⏱ Audited in 48 seconds</span>
              <a
                href="#audit"
                className="text-[11px] font-semibold text-[#0ABFBC] hover:text-[#08A8A5] transition-colors flex items-center gap-1 group"
              >
                Generate dispute letters
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>

          </div>
        </motion.div>

      </div>
    </section>
  )
}
