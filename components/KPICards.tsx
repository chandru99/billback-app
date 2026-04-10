'use client'

import { useEffect, useRef, useState } from 'react'
import { Flag, TrendingUp } from 'lucide-react'
import { CaseData } from '@/lib/types'

interface Props { caseData: CaseData }

function useCountUp(target: number, duration = 1200, prefix = '', suffix = '') {
  const [value, setValue] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * ease))
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration])

  if (prefix === '$') return `$${value.toLocaleString()}${suffix}`
  return `${prefix}${value.toLocaleString()}${suffix}`
}

function GaugeCard({ rps, delay = 0 }: { rps: number; delay?: number }) {
  const [current, setCurrent] = useState(0)
  const [visible, setVisible] = useState(false)
  const started = useRef(false)

  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t) }, [delay])

  useEffect(() => {
    if (started.current) return
    started.current = true
    const duration = 1500
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setCurrent(Math.round(rps * ease))
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [rps])

  const totalLen = 232
  const dashLen = (current / 100) * totalLen
  const angleRad = -Math.PI + (current / 100) * Math.PI
  const nx = 90 + 74 * Math.cos(angleRad)
  const ny = 90 + 74 * Math.sin(angleRad)
  const color = current >= 75 ? '#00BFA5' : current >= 45 ? '#F5C242' : '#E53935'

  return (
    <div
      className={`bg-white rounded-2xl p-5 flex items-start gap-4 transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      }`}
      style={{ boxShadow: '0 1px 3px rgba(15,31,61,0.06), 0 4px 16px rgba(15,31,61,0.04)' }}
    >
      {/* Gauge sits where the icon would be */}
      <div className="flex flex-col items-center flex-shrink-0 -mt-1">
        <svg viewBox="0 0 180 100" className="w-[88px] h-[50px]">
          <defs>
            <linearGradient id="rps-g" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E53935" />
              <stop offset="50%" stopColor="#F5C242" />
              <stop offset="100%" stopColor="#00BFA5" />
            </linearGradient>
          </defs>
          <path d="M 16 90 A 74 74 0 0 1 164 90" fill="none" stroke="#EEF2F7" strokeWidth="14" strokeLinecap="round" />
          <path
            d="M 16 90 A 74 74 0 0 1 164 90"
            fill="none" stroke="url(#rps-g)" strokeWidth="14" strokeLinecap="round"
            strokeDasharray={`${dashLen} ${totalLen - dashLen}`}
          />
          <circle cx={nx} cy={ny} r="6" fill="#0F1F3D" />
        </svg>
        <div className="font-display text-lg font-black tabular-nums leading-none" style={{ color }}>{current}%</div>
      </div>

      {/* Label + sub — same position as KPICard text block */}
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[1.5px] text-[#9BAABB] font-semibold mb-1">Weighted RPS</div>
        <div className="text-xs text-[#9BAABB] mt-5">recovery probability</div>
      </div>
    </div>
  )
}

function KPICard({ label, value, sub, icon, delay = 0 }: {
  label: string
  value: string
  sub: React.ReactNode
  icon: React.ReactNode
  delay?: number
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t) }, [delay])

  return (
    <div
      className={`bg-white rounded-2xl p-5 flex items-start gap-4 transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      }`}
      style={{ boxShadow: '0 1px 3px rgba(15,31,61,0.06), 0 4px 16px rgba(15,31,61,0.04)' }}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#F0F4F8] flex items-center justify-center">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[1.5px] text-[#9BAABB] font-semibold mb-1">{label}</div>
        <div className="font-display text-2xl font-black leading-none mb-1 tabular-nums text-[#0F1F3D]">{value}</div>
        <div className="text-xs text-[#9BAABB]">{sub}</div>
      </div>
    </div>
  )
}

export default function KPICards({ caseData }: Props) {
  const totalOvercharge = caseData.claims.reduce((s, c) => s + c.overcharge, 0)
  const flagged    = useCountUp(caseData.totalFlagged, 800)
  const overcharge = useCountUp(totalOvercharge, 1000, '$')
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

      <KPICard
        label="Claims Flagged"
        value={flagged}
        sub={`of ${caseData.totalAudited} audited`}
        delay={0}
        icon={<Flag className="w-4 h-4 text-[#1A6EA8]" />}
      />

      <KPICard
        label="Total Overcharge"
        value={overcharge}
        sub="pending dispute"
        delay={60}
        icon={<TrendingUp className="w-4 h-4 text-[#E53935]" />}
      />

      <GaugeCard rps={caseData.weightedRPS} delay={120} />

    </div>
  )
}
