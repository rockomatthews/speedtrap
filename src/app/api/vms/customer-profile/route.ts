import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAuthedProfile } from '@/lib/supabase/profile';
import { VmsClient } from '@/lib/vms/client';
import { vmsErrorResponse } from '@/lib/vms/route-errors';

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional();

const profileSchema = z.object({
  name: z.string().trim().min(3, 'Driver name must be at least 3 characters.').optional(),
  tel: optionalText,
  cell: optionalText,
  email: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : null))
    .pipe(z.string().email('Use a valid email address.').nullable())
    .optional(),
  emailOptin: z.boolean().nullable().optional(),
  postalCode: optionalText,
  classId: z.number().int().positive().nullable().optional()
});

export async function GET() {
  const { user, profile } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!profile?.vms_customer_id) {
    return NextResponse.json({ error: 'VMS customer is not linked yet. Please refresh your portal.' }, { status: 412 });
  }

  try {
    const vms = VmsClient.fromEnv();
    const [customer, classes] = await Promise.all([vms.getCustomer(profile.vms_customer_id), vms.getClasses()]);
    if (!customer) return NextResponse.json({ error: 'VMS did not return a customer profile.' }, { status: 502 });
    return NextResponse.json({ customer, classes });
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
    const customer = await vms.updateCustomer(profile.vms_customer_id, parsed.data);
    if (!customer) return NextResponse.json({ error: 'VMS did not return the updated customer profile.' }, { status: 502 });
    return NextResponse.json({ customer });
  } catch (error) {
    return vmsErrorResponse(error);
  }
}
