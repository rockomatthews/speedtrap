import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/require-admin';
import { getBookingAvailability } from '@/lib/bookings/availability';
import { supportedBookingDuration } from '@/lib/bookings/config';
import { syncUpcomingVmsBookings } from '@/lib/bookings/vms-sync';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.coerce.number().int().refine(supportedBookingDuration, 'Unsupported booking duration.').default(15),
  simCount: z.coerce.number().int().min(1).max(4).default(1)
});

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid operations query.' }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    await syncUpcomingVmsBookings(supabase);

    const [timeline, walkIn] = await Promise.all([
      getBookingAvailability(supabase, { date: parsed.data.date, durationMinutes: 15, simCount: 1 }),
      getBookingAvailability(supabase, parsed.data)
    ]);

    return NextResponse.json({ timeline, walkIn });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load operations board.' }, { status: 500 });
  }
}
