import 'server-only';
import { unstable_noStore as noStore } from 'next/cache';

import { racingDiscountSchema, type RacingDiscount } from '@/lib/bookings/discount';
import { utcToVenueDate } from '@/lib/bookings/time';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function getRacingDiscount(supabase = createSupabaseAdminClient()): Promise<RacingDiscount> {
  noStore();
  const { data, error } = await supabase.from('racing_discount_settings')
    .select('enabled,percent').eq('id', 1).single();
  if (error || !data) throw new Error('Racing prices are temporarily unavailable. Please try again.');
  return racingDiscountSchema.parse(data);
}

// Supply the venue date from the server so a visitor's timezone cannot change eligibility.
export async function getRacingDiscountForDisplay() {
  const discount = await getRacingDiscount();
  return { ...discount, venueDate: utcToVenueDate(new Date()) };
}
