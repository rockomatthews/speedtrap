import { z } from 'zod';

// Keep even the shortest paid session above Stripe's minimum charge.
export const MAX_RACING_DISCOUNT_PERCENT = 95;
export const racingDiscountSchema = z.object({
  enabled: z.boolean(),
  percent: z.number().int().min(0).max(MAX_RACING_DISCOUNT_PERCENT)
}).strict().refine((value) => !value.enabled || value.percent > 0, {
  message: 'Enter a discount greater than 0% before enabling discount mode.', path: ['percent']
});

export type RacingDiscount = { enabled: boolean; percent: number };

export const racingDiscountDisplaySchema = z.object({
  enabled: z.boolean(),
  percent: z.number().int().min(0).max(MAX_RACING_DISCOUNT_PERCENT),
  venueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
}).strict();
export type RacingDiscountDisplay = z.infer<typeof racingDiscountDisplaySchema>;

export function applyRacingDiscount(amountCents: number, discount: RacingDiscount, sessionDate: string, venueDate: string, memberPricing = false) {
  const parsed = racingDiscountSchema.parse({ enabled: discount.enabled, percent: discount.percent });
  const percent = parsed.enabled && !memberPricing && /^\d{4}-\d{2}-\d{2}$/.test(venueDate) && sessionDate === venueDate ? parsed.percent : 0;
  const discountCents = Math.round(amountCents * percent / 100);
  return { amountCents: amountCents - discountCents, discountCents, percent };
}
