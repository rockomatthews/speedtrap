import { z } from 'zod';

const stripeEnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().min(10),
  STRIPE_WEBHOOK_SECRET: z.string().min(10),

  // Stripe Price IDs for the merch catalog.
  STRIPE_PRICE_HOODIE: z.string().min(1),
  STRIPE_PRICE_TSHIRT: z.string().min(1),
  STRIPE_PRICE_KEYCHAIN: z.string().min(1)
});

export const stripeEnv = stripeEnvSchema.parse({
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_HOODIE: process.env.STRIPE_PRICE_HOODIE,
  STRIPE_PRICE_TSHIRT: process.env.STRIPE_PRICE_TSHIRT,
  STRIPE_PRICE_KEYCHAIN: process.env.STRIPE_PRICE_KEYCHAIN
});

