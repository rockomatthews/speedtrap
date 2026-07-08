'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

export function MembershipCheckoutButton({
  children = 'Join for $45/month',
  manage = false
}: {
  children?: ReactNode;
  manage?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    try {
      const response = await fetch(manage ? '/api/stripe/membership/portal' : '/api/stripe/membership/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const json = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (response.status === 401) {
        window.location.href = `/login?redirectTo=${encodeURIComponent('/pricing')}`;
        return;
      }
      if (!response.ok || !json?.url) throw new Error(json?.error ?? 'Could not open Stripe.');
      window.location.href = json.url;
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not open Stripe.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="contained" size="large" onClick={start} disabled={loading} sx={{ alignSelf: 'flex-start' }}>
      {loading ? <CircularProgress color="inherit" size={22} /> : children}
    </Button>
  );
}
