import { NextResponse } from 'next/server'
import { getPublicTrip } from '@/server/queries/trips'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const trip = await getPublicTrip(slug)
  if (!trip) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(trip)
}
