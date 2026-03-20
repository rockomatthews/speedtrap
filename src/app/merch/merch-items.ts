export type MerchItem = {
  id: string;
  name: string;
  description: string;
  priceId: string;
  imageUrl?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  inventoryCount?: number | null;
};
