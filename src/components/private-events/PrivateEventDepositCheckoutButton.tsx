'use client';

import { useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';

export function PrivateEventDepositCheckoutButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function startCheckout() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/private-event-deposits/${token}/checkout`, { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to start deposit checkout.');
      if (!payload.url) throw new Error('Stripe did not return a checkout link.');
      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start deposit checkout.');
      setLoading(false);
    }
  }

  return (
    <Stack spacing={1}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Button variant="contained" size="large" onClick={startCheckout} disabled={loading}>
        {loading ? 'Opening Stripe...' : 'Pay 50% Deposit'}
      </Button>
    </Stack>
  );
}
