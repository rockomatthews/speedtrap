import { z } from 'zod';

const stripeEnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().min(10),
  STRIPE_WEBHOOK_SECRET: z.string().min(10)
});

export type StripeEnv = z.infer<typeof stripeEnvSchema>;

/**
 * Stripe env validation is intentionally lazy.
 * Next.js can import/execute route modules during build-time "collect page data",
 * and we don't want builds to fail just because env vars aren't set yet.
 */
export function getStripeEnv(): StripeEnv {
  return stripeEnvSchema.parse({
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET
  });
}

