import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getBookingAvailability } from '@/lib/bookings/availability';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.coerce.number().int().refine((value) => value === 15 || value === 30).default(15),
  simCount: z.coerce.number().int().min(1).max(4).default(1)
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid availability query.' }, { status: 400 });

  try {
    const availability = await getBookingAvailability(createSupabaseAdminClient(), parsed.data);
    return NextResponse.json(availability);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load availability.' }, { status: 500 });
  }
}
