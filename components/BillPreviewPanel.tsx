'use client'

import { useState, useEffect } from 'react'
import { CaseData } from '@/lib/types'
import { ChevronDown, ChevronUp, FileText, ImageIcon } from 'lucide-react'

interface Props {
  caseData: CaseData
  billImage: string | null
}

export default function BillPreviewPanel({ caseData, billImage }: Props) {
  const [open, setOpen]       = useState(true)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!billImage?.startsWith('data:application/pdf')) return
    const byteString = atob(billImage.split(',')[1])
    const bytes = new Uint8Array(byteString.length)
    for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    setBlobUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [billImage])

  const hasImage = !!billImage
  const isPdf    = billImage?.startsWith('data:application/pdf') ?? false
  const hasText  = !!caseData.rawText

  // Nothing to show for demo cases
  if (!hasImage && !hasText) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {hasImage
            ? <ImageIcon className="w-4 h-4 text-[#0ABFBC]" />
            : <FileText  className="w-4 h-4 text-[#0ABFBC]" />
          }
          <span className="text-sm font-semibold text-[#0F1F3D]">Original Bill</span>
        </div>
        {open
          ? <ChevronUp   className="w-4 h-4 text-[#6B82A0]" />
          : <ChevronDown className="w-4 h-4 text-[#6B82A0]" />
        }
      </button>

      {open && (
        <div className="border-t border-gray-100 px-6 pt-5 pb-6 bg-[#F7F9FC]">
          {hasImage && isPdf ? (
            <iframe
              src={blobUrl ? `${blobUrl}#toolbar=0&view=FitH` : ''}
              className="w-full h-80 rounded-xl border border-gray-200 bg-white shadow-sm"
              title="Bill preview"
            />
          ) : hasImage ? (
            <img
              src={billImage!}
              alt="Original bill"
              className="max-h-72 object-contain rounded-xl border border-gray-200 bg-white mx-auto block shadow-sm"
            />
          ) : (
            <pre className="text-xs text-[#6B82A0] whitespace-pre-wrap font-mono bg-white border border-gray-200 rounded-xl p-4 max-h-48 overflow-y-auto leading-relaxed">
              {caseData.rawText}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
