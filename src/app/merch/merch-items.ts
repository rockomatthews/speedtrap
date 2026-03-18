import { stripeEnv } from '@/lib/stripe/env';

export type MerchItem = {
  id: 'hoodie' | 'tshirt' | 'keychain';
  name: string;
  description: string;
  priceId: string;
};

export const merchItems: MerchItem[] = [
  {
    id: 'hoodie',
    name: 'Hoodie',
    description: 'Heavyweight hoodie for race nights.',
    priceId: stripeEnv.STRIPE_PRICE_HOODIE
  },
  {
    id: 'tshirt',
    name: 'T-Shirt',
    description: 'Soft cotton tee with track-ready style.',
    priceId: stripeEnv.STRIPE_PRICE_TSHIRT
  },
  {
    id: 'keychain',
    name: 'Keychain',
    description: 'Small accessory to keep your pass handy.',
    priceId: stripeEnv.STRIPE_PRICE_KEYCHAIN
  }
];

