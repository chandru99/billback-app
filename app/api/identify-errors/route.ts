import { NextRequest, NextResponse } from 'next/server'
import { classifyAndBuildCase } from '@/lib/claude'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { patientName, dateOfService, facility, claims, clinicalNotes } = await req.json()

    if (!claims || claims.length === 0) {
      return NextResponse.json({ success: false, error: 'No claims provided' }, { status: 400 })
    }

    const data = await classifyAndBuildCase(
      claims,
      { patientName, dateOfService, facility },
      'uploaded',
      clinicalNotes
    )
    return NextResponse.json({ success: true, data })

  } catch (err) {
    console.error('Identify errors:', err)
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to identify errors'
    }, { status: 500 })
  }
}
