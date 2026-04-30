// Shared logo component — use variant="light" on dark backgrounds, "dark" on light backgrounds
interface Props {
  variant?: 'light' | 'dark'
  showBeta?: boolean
  size?: 'sm' | 'md'
}

export default function Logo({ variant = 'dark', showBeta = false, size = 'md' }: Props) {
  const iconSize  = size === 'sm' ? 'w-5 h-5' : 'w-7 h-7'
  const iconText  = size === 'sm' ? 'text-[9px]' : 'text-xs'
  const labelSize = size === 'sm' ? 'text-sm' : 'text-base'
  const labelColor = variant === 'light' ? 'text-white' : 'text-[#1A1B20]'

  return (
    <div className="flex items-center gap-2.5">
      <div className={`${iconSize} bg-[#0F1F3D] rounded-lg flex items-center justify-center flex-shrink-0`}>
        <span className={`text-[#0ABFBC] ${iconText} font-black`}>B</span>
      </div>
      <span className={`${labelSize} font-bold tracking-tight ${labelColor}`}>BillBack AI</span>
      {showBeta && (
        <span className="text-[10px] font-semibold text-[#0ABFBC] bg-[#0ABFBC]/10 px-2 py-0.5 rounded-full uppercase tracking-wide border border-[#0ABFBC]/20">
          Beta
        </span>
      )}
    </div>
  )
}
