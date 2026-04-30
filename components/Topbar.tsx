'use client'

import { CaseData } from '@/lib/types'

interface TopbarProps { caseData: CaseData; onFileDispute: () => void }
export default function Topbar({ caseData, onFileDispute }: TopbarProps) {
  return (
    <header className="bg-[#F5F3EE] border-b border-[#D6D1C8] px-4 md:px-6 py-3 flex items-center gap-2 md:gap-3 sticky top-0 z-10">
      <div className="hidden sm:flex text-xs text-[#6B6860] items-center gap-1.5">
        Home <span className="text-[#6B6860]/50">›</span> <span className="text-[#1A1B20] font-semibold">Dashboard</span>
      </div>
      <div className="flex-1" />
      <div className="bg-[#E8A020]/10 text-[#C8841A] border border-[#E8A020]/25 text-xs font-semibold font-mono px-2 md:px-3 py-1.5 rounded-md truncate max-w-[120px] md:max-w-none">
        #{caseData.caseId}
      </div>
      <div className="hidden sm:block bg-[#EAE7E0] border border-[#D6D1C8] text-xs text-[#6B6860] font-medium px-3 py-1.5 rounded-md">
        Q1 2024
      </div>
      <button
        onClick={onFileDispute}
        className="bg-[#E8A020] text-[#0D0F14] text-xs font-bold px-3 md:px-4 py-1.5 rounded-lg hover:bg-[#C8841A] transition-colors whitespace-nowrap"
      >
        + Dispute
      </button>
    </header>
  )
}
