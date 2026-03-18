import { z } from 'zod';

const stripeEnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().min(10),
  STRIPE_WEBHOOK_SECRET: z.string().min(10)
});

export const stripeEnv = stripeEnvSchema.parse({
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET
});

