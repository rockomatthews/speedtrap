import { NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthedProfile } from '@/lib/supabase/profile';
import { VmsClient } from '@/lib/vms/client';
import { getPublicDriverMeta, toPublicDriver } from '@/lib/vms/driver-public';
import { vmsErrorResponse } from '@/lib/vms/route-errors';

export async function GET(request: Request) {
  const { user } = await getAuthedProfile();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ drivers: [] });

  try {
    const vms = VmsClient.fromEnv();
    const customers = (await vms.searchCustomersByName(q)).slice(0, 12);
    const meta = await getPublicDriverMeta(
      createSupabaseAdminClient(),
      customers.map((customer) => customer.id)
    );

    return NextResponse.json({
      drivers: customers.map((customer) => toPublicDriver(customer, meta.get(customer.id)))
    });
  } catch (error) {
    return vmsErrorResponse(error);
  }
}
