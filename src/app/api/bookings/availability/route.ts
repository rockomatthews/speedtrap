import { NextResponse } from 'next/server';
import { z } from 'zod';

import { validateBookingDateWithinWindow } from '@/lib/bookings/advance-window';
import { getBookingAvailability } from '@/lib/bookings/availability';
import { MAX_CUSTOM_DURATION_MINUTES, MIN_CUSTOM_DURATION_MINUTES, supportedBookingDuration } from '@/lib/bookings/config';
import { syncUpcomingVmsBookings } from '@/lib/bookings/vms-sync';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createRouteHandlerClient } from '@/lib/supabase/route-handler';

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(MIN_CUSTOM_DURATION_MINUTES)
    .max(MAX_CUSTOM_DURATION_MINUTES)
    .refine(supportedBookingDuration, 'Unsupported booking duration.')
    .default(15),
  simCount: z.coerce.number().int().min(1).max(4).default(1)
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid availability query.' }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    const authClient = await createRouteHandlerClient();
    const {
      data: { user }
    } = await authClient.auth.getUser().catch(() => ({ data: { user: null } }));
    let profile = null;
    if (user?.id) {
      const { data } = await supabase
        .from('profiles')
        .select('membership_status,membership_current_period_end')
        .eq('id', user.id)
        .maybeSingle();
      profile = data ?? null;
    }
    const windowCheck = validateBookingDateWithinWindow(parsed.data.date, profile);
    if (!windowCheck.ok) return NextResponse.json({ error: windowCheck.error }, { status: 403 });

    await syncUpcomingVmsBookings(supabase);
    const availability = await getBookingAvailability(supabase, parsed.data);
    return NextResponse.json(availability);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load availability.' }, { status: 500 });
  }
}
