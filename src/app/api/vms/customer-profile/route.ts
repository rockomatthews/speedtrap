import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAuthedProfile } from '@/lib/supabase/profile';
import { VmsClient } from '@/lib/vms/client';
import { vmsErrorResponse } from '@/lib/vms/route-errors';

const profileSchema = z.object({
  name: z.string().trim().min(3, 'Driver name must be at least 3 characters.'),
  email: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : null))
    .pipe(z.string().email('Use a valid email address.').nullable())
    .optional()
});

export async function GET() {
  const { user, profile } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!profile?.vms_customer_id) {
    return NextResponse.json({ error: 'VMS customer is not linked yet. Please refresh your portal.' }, { status: 412 });
  }

  try {
    const vms = VmsClient.fromEnv();
    const customer = await vms.getCustomer(profile.vms_customer_id);
    if (!customer) return NextResponse.json({ error: 'VMS did not return a customer profile.' }, { status: 502 });
    return NextResponse.json({ customer });
  } catch (error) {
    return vmsErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const { user, profile } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!profile?.vms_customer_id) {
    return NextResponse.json({ error: 'VMS customer is not linked yet. Please refresh your portal.' }, { status: 412 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid VMS profile.' }, { status: 400 });
  }

  try {
    const vms = VmsClient.fromEnv();
    let customer = await vms.updateCustomer(profile.vms_customer_id, parsed.data);
    customer ??= await vms.getCustomer(profile.vms_customer_id);
    customer ??= {
      id: profile.vms_customer_id,
      name: parsed.data.name,
      email: parsed.data.email ?? user.email ?? null,
      tel: null,
      cell: null,
      emailOptin: null,
      postalCode: null,
      homeVenue: null,
      className: null,
      classId: null,
      memberships: [],
      lapsRecorded: null,
      lastVisit: null,
      lastVehicle: null,
      lastCircuit: null,
      lastGroupEvent: null,
      lastRaceEvent: null,
      customerUri: null,
      venueUri: null,
      classUri: null,
      lapTimesUri: null,
      vehicleUri: null,
      circuitUri: null,
      raceEventUri: null
    };
    return NextResponse.json({ customer });
  } catch (error) {
    return vmsErrorResponse(error);
  }
}
