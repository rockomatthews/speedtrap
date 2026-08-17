export const STRIPE_SALES_TAX_RATE_BPS = 800;
export const STRIPE_SALES_TAX_RATE_PERCENT = STRIPE_SALES_TAX_RATE_BPS / 100;
export const STRIPE_SALES_TAX_LABEL = `Sales tax (${STRIPE_SALES_TAX_RATE_PERCENT}%)`;

export function salesTaxCents(subtotalCents: number) {
  if (!Number.isFinite(subtotalCents) || subtotalCents <= 0) return 0;
  return Math.round(subtotalCents * (STRIPE_SALES_TAX_RATE_BPS / 10000));
}

export function totalWithSalesTaxCents(subtotalCents: number) {
  return Math.max(0, Math.floor(subtotalCents)) + salesTaxCents(subtotalCents);
}

export function salesTaxMetadata(subtotalCents: number) {
  const taxCents = salesTaxCents(subtotalCents);
  return {
    subtotal_cents: String(Math.max(0, Math.floor(subtotalCents))),
    sales_tax_cents: String(taxCents),
    sales_tax_rate_percent: String(STRIPE_SALES_TAX_RATE_PERCENT),
    total_cents: String(Math.max(0, Math.floor(subtotalCents)) + taxCents)
  };
}
