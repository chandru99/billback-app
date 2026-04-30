'use client'

import { useRouter, usePathname } from 'next/navigation'
import { LayoutDashboard, ClipboardCheck, FileText, DollarSign, TrendingUp, Users, Settings, ArrowLeft } from 'lucide-react'
import { CaseData } from '@/lib/types'
import Logo from '@/components/Logo'

interface Props { caseData: CaseData }

const NAV = [
  { section: 'Main', items: [
    { icon: LayoutDashboard, label: 'Dashboard',   href: '/dashboard', badge: null },
    { icon: ClipboardCheck, label: 'Claim Audit',  href: '/claim-audit', badge: (d: CaseData) => d.totalFlagged > 0 ? String(d.totalFlagged) : null },
    { icon: FileText,       label: 'Disputes',     href: '/dispute',   badge: (d: CaseData) => d.activeDisputes > 0 ? String(d.activeDisputes) : null },
    { icon: DollarSign,     label: 'Recoveries',   href: '/dashboard', badge: null },
  ]},
  { section: 'Analytics', items: [
    { icon: TrendingUp, label: 'RPS Reports', href: '/dashboard', badge: null },
    { icon: Users,      label: 'Providers',   href: '/dashboard', badge: null },
    { icon: Settings,   label: 'Settings',    href: '/dashboard', badge: null },
  ]}
]

const BOTTOM_NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: ClipboardCheck,  label: 'Audit',     href: '/claim-audit' },
  { icon: FileText,        label: 'Disputes',  href: '/dispute' },
  { icon: ArrowLeft,       label: 'New Bill',  href: '/' },
]

export default function Sidebar({ caseData }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-[240px] bg-[#0D0F14] flex-col flex-shrink-0 sticky top-0 h-screen overflow-y-auto">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/08">
          <Logo variant="light" />
          <div className="text-[10px] uppercase tracking-[1.5px] text-white/25 mt-0.5">Payment Integrity</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4">
          {NAV.map(({ section, items }) => (
            <div key={section}>
              <div className="text-[10px] uppercase tracking-[1.5px] text-white/20 px-2 py-1.5 mt-2 mb-0.5">{section}</div>
              {items.map(({ icon: Icon, label, href, badge }) => {
                const isActive = pathname === href
                const badgeVal = typeof badge === 'function' ? badge(caseData) : badge
                return (
                  <button
                    key={label}
                    onClick={() => router.push(href)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-[13px] font-medium transition-all mb-0.5 ${
                      isActive
                        ? 'bg-[#E8A020]/14 text-[#E8A020]'
                        : 'text-white/40 hover:bg-white/05 hover:text-white/75'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {label}
                    {badgeVal && (
                      <span className="ml-auto bg-[#E53935] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {badgeVal}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/08">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-white/25 hover:text-white/50 text-xs transition-colors mb-3"
          >
            <ArrowLeft className="w-3 h-3" /> New Bill
          </button>
          <div className="text-[12px] font-semibold text-white/50">{caseData.employer.name}</div>
          <div className="text-[11px] text-white/25 mt-0.5">{caseData.employer.employees} ee · {caseData.employer.tpa}</div>
        </div>
      </aside>

      {/* Mobile bottom nav — hidden on desktop */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 bg-[#0D0F14] border-t border-white/10 z-50 safe-area-bottom">
        {BOTTOM_NAV.map(({ icon: Icon, label, href }) => {
          const isActive = pathname === href
          return (
            <button
              key={label}
              onClick={() => router.push(href)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
                isActive ? 'text-[#E8A020]' : 'text-white/40 active:text-white/70'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
