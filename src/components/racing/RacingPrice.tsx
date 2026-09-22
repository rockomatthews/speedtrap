'use client';

import Box from '@mui/material/Box';
import { bookingAmountCents } from '@/lib/bookings/config';
import { applyRacingDiscount } from '@/lib/bookings/discount';
import { useRacingDiscount } from '@/components/racing/RacingDiscountProvider';

export function RacingPrice({ durationMinutes, simCount = 1 }: { durationMinutes: number; simCount?: number }) {
  const discount = useRacingDiscount();
  const base = bookingAmountCents(durationMinutes, simCount);
  if (!discount || base === null) return <Box component="span" sx={{ fontSize: 16 }}>Price temporarily unavailable</Box>;
  const price = applyRacingDiscount(base, discount, discount.venueDate, discount.venueDate);
  const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 ? 2 : 0, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
  return <Box component="span">
    {price.percent > 0 && <Box component="span" sx={{ display: 'block', fontSize: 16, color: 'text.secondary', textDecoration: 'line-through', mb: 0.5 }}>{money(base)}</Box>}
    {money(price.amountCents)}
    {price.percent > 0 && <Box component="span" sx={{ display: 'block', fontSize: 13, lineHeight: 1.4, mt: 1 }}>{price.percent}% off today’s standard racing · future dates at regular price · excludes member pricing</Box>}
  </Box>;
}
