export const WINTER_SERIES_SLUG = 'winter-series-2026-27';
export const WINTER_DEPOSIT_CENTS = 5000;
export const WINTER_SIGNUP_CLOSE = '2026-11-23T05:00:00Z';
export const isWinterSeries = (slug: string) => slug === WINTER_SERIES_SLUG;

export function leagueRegistrationAmount(league: { slug: string; weekly_fee_cents: number; full_season_fee_cents: number }, option: 'installments' | 'full_season') {
  return option === 'full_season' ? Number(league.full_season_fee_cents) : isWinterSeries(league.slug) ? WINTER_DEPOSIT_CENTS : Number(league.weekly_fee_cents);
}

// Paid weeks retain their full dues; a partial deposit reduces the next unpaid due.
export function installmentDues(weeks: number, weeklyCents: number, paidCents: number) {
  let credit = paidCents;
  return Array.from({ length: weeks }, (_, index) => {
    const applied = Math.min(weeklyCents, Math.max(0, credit));
    credit -= applied;
    const paid = applied === weeklyCents;
    return {
      week_number: index + 1,
      amount_cents: paid ? weeklyCents : weeklyCents - applied,
      status: paid ? 'paid' : 'pending',
      notes: applied > 0 ? `$${(applied / 100).toFixed(2)} registration payment credited toward this week's dues.${paid ? '' : ` Remaining due: $${((weeklyCents - applied) / 100).toFixed(2)}.`}` : 'Future weekly league installment'
    };
  });
}
