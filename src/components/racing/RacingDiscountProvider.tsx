'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { racingDiscountDisplaySchema, type RacingDiscountDisplay } from '@/lib/bookings/discount';

const DiscountContext = createContext<RacingDiscountDisplay | null>(null);
export const useRacingDiscount = () => useContext(DiscountContext);

export function RacingDiscountProvider({ initialDiscount, children }: { initialDiscount: RacingDiscountDisplay | null; children: ReactNode }) {
  const [discount, setDiscount] = useState(initialDiscount);
  useEffect(() => {
    let cancelled = false;
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch('/api/bookings/discount', { cache: 'no-store' });
        if (!response.ok) throw new Error('Prices unavailable');
        const json = await response.json();
        const next = racingDiscountDisplaySchema.parse(json.discount);
        if (!cancelled) setDiscount(next);
      } catch {
        if (!cancelled) setDiscount(null);
      } finally { pending = false; }
    }
    void refresh();
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => { cancelled = true; window.clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, []);
  return <DiscountContext.Provider value={discount}>{children}</DiscountContext.Provider>;
}
