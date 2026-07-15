import { NextResponse } from 'next/server';

import { bookingDateWindow } from '@/lib/bookings/advance-window';
import { hasUnusedBirthdayRace, hasUnusedMonthlyRace, isBirthdayMonth, isMembershipActive, MEMBERSHIP_DISCOUNT_PERCENT } from '@/lib/membership';
import { getAuthedProfile } from '@/lib/supabase/profile';
import { VmsClient } from '@/lib/vms/client';

export async function GET() {
  const { user, profile } = await getAuthedProfile();
  if (!user) return NextResponse.json({ user: null, customer: null });

  let customer = null;
  if (profile?.vms_customer_id) {
    try {
      customer = await VmsClient.fromEnv().getCustomer(profile.vms_customer_id);
    } catch {
      customer = null;
    }
  }

  return NextResponse.json({
    user: {
      email: user.email ?? null,
      name: (user.user_metadata?.full_name as string | undefined) ?? profile?.display_name ?? null
    },
    membership: profile
      ? {
          status: isMembershipActive(profile) ? profile.membership_status : 'inactive',
          freeRaceAvailable: hasUnusedMonthlyRace(profile),
          monthly15Available: hasUnusedMonthlyRace(profile),
          birthday30Available: hasUnusedBirthdayRace(profile),
          birthdayMonthActive: isBirthdayMonth(profile),
          birthday: profile.birthday,
          discountPercent: MEMBERSHIP_DISCOUNT_PERCENT
        }
      : null,
    bookingWindow: bookingDateWindow(profile),
    customer
  });
}
