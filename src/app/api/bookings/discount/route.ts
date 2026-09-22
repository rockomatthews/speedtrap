import { NextResponse } from 'next/server';
import { getRacingDiscountForDisplay } from '@/lib/bookings/discount-server';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return NextResponse.json({ discount: await getRacingDiscountForDisplay() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Racing prices are temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
