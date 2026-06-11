import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthedProfile } from '@/lib/supabase/profile';
import { VmsClient } from '@/lib/vms/client';
import { vmsErrorResponse } from '@/lib/vms/route-errors';
import { type VmsCustomerProfile } from '@/lib/vms/types';

function normalizeDriverName(value: string) {
  return value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

const profileSchema = z.object({
  name: z
    .string()
    .transform(normalizeDriverName)
    .pipe(z.string().min(3, 'Driver name must be at least 3 characters.'))
});

function withDisplayNameFallback(customer: VmsCustomerProfile, displayName?: string | null): VmsCustomerProfile {
  const fallback = displayName?.trim();
  if (customer.name.trim().length > 0 || !fallback) return customer;
  return { ...customer, name: fallback };
}

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
    return NextResponse.json({
      customer: withDisplayNameFallback(customer, profile.display_name),
      profile: { avatarUrl: profile.avatar_url, displayName: profile.display_name }
    });
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
    let customer = await vms.updateCustomer(profile.vms_customer_id, { name: parsed.data.name });
    customer ??= await vms.getCustomer(profile.vms_customer_id);
    if (!customer) return NextResponse.json({ error: 'VMS updated the customer but did not return driver data.' }, { status: 502 });

    const supabaseAdmin = createSupabaseAdminClient();
    await supabaseAdmin.from('profiles').update({ display_name: parsed.data.name }).eq('id', user.id);

    const vmsPersisted = customer.name.trim().toLowerCase() === parsed.data.name.trim().toLowerCase();
    return NextResponse.json({
      customer: withDisplayNameFallback(customer, parsed.data.name),
      profile: { avatarUrl: profile.avatar_url, displayName: parsed.data.name },
      warning: vmsPersisted ? null : 'VMS accepted the update request but did not persist the driver name yet. The portal is showing your saved site profile name.'
    });
  } catch (error) {
    return vmsErrorResponse(error);
  }
}
