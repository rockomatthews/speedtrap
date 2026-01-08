'use client';

import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';

/**
 * Ensures the signed-in user has a linked VMS customer id (`profiles.vms_customer_id`).
 * Safe to render on any authed page.
 */
export function EnsureVmsCustomer() {
  const [state, setState] = useState<'idle' | 'ok' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch('/api/vms/customers/ensure', { method: 'POST' });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as any;
          throw new Error(data?.error ?? `Failed (${res.status})`);
        }
        if (cancelled) return;
        setState('ok');
      } catch (e) {
        if (cancelled) return;
        setState('error');
        setError(e instanceof Error ? e.message : 'Failed to link VMS customer.');
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state !== 'error') return null;
  return <Alert severity="warning">VMS customer link not ready: {error}</Alert>;
}


