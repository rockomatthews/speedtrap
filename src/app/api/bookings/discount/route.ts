import { NextResponse } from 'next/server';
import { getRacingDiscount } from '@/lib/bookings/discount-server';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return NextResponse.json({ discount: await getRacingDiscount() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Racing prices are temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
