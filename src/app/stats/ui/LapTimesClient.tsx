'use client';

import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

import { DriverRacingProfile, type DriverDetail } from '@/components/portal/DriverRacingProfile';

export function LapTimesClient() {
  const [data, setData] = useState<DriverDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const ensureRes = await fetch('/api/vms/customers/ensure', { method: 'POST' });
        const ensureJson = (await ensureRes.json().catch(() => null)) as { vms_customer_id?: number; customer?: { id?: number }; error?: string } | null;
        if (!ensureRes.ok) throw new Error(ensureJson?.error ?? `Failed (${ensureRes.status})`);
        const customerId = ensureJson?.vms_customer_id ?? ensureJson?.customer?.id;
        if (!customerId) throw new Error('VMS customer is not linked yet.');

        const res = await fetch(`/api/vms/drivers/${customerId}?lapCount=50`);
        const json = (await res.json().catch(() => null)) as (DriverDetail & { error?: string }) | null;
        if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
        if (!json?.driver) throw new Error('Driver details were not returned.');
        if (cancelled) return;
        setData({ driver: json.driver, laps: json.laps ?? [], placements: json.placements ?? [] });
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load lap times.');
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <CircularProgress size={20} />;

  return <DriverRacingProfile detail={data} />;
}

