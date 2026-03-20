'use client';

import { useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import CardMedia from '@mui/material/CardMedia';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { MerchItem } from '../merch-items';

export function MerchClient({ items }: { items: MerchItem[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Stack spacing={2}>
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
        {items.map((item) => {
          const stock = item.inventoryCount ?? 0;
          const inStock = stock > 0;

          return (
            <Card
              key={item.id}
              variant="outlined"
              sx={{
                borderColor: 'rgba(255,255,255,0.12)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))'
              }}
            >
              {item.imageUrl ? (
                <CardMedia component="img" image={item.imageUrl} alt={item.name} sx={{ height: 220, objectFit: 'cover' }} />
              ) : null}
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  {item.name}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  {item.description}
                </Typography>
                {typeof item.priceCents === 'number' ? (
                  <Typography sx={{ mt: 1, fontWeight: 900 }}>
                    {(item.currency ?? 'usd').toUpperCase()} {(item.priceCents / 100).toFixed(2)}
                  </Typography>
                ) : null}
                <Typography color={inStock ? 'text.secondary' : 'error'} sx={{ mt: 0.5 }}>
                  {inStock ? `In stock: ${stock}` : 'Out of stock'}
                </Typography>
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2 }}>
                <Button
                  variant="contained"
                  size="large"
                  disabled={loadingId !== null || !inStock}
                  onClick={async () => {
                    setError(null);
                    setLoadingId(item.id);

                    try {
                      const res = await fetch('/api/stripe/checkout-session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ priceId: item.priceId, quantity: 1 })
                      });

                      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
                      if (!res.ok || !data?.url) {
                        throw new Error(data?.error ?? 'Failed to start checkout.');
                      }

                      window.location.href = data.url;
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Failed to start checkout.');
                      setLoadingId(null);
                    }
                  }}
                >
                  {loadingId === item.id ? <CircularProgress size={18} /> : 'Buy'}
                </Button>
              </CardActions>
            </Card>
          );
        })}
      </Box>
    </Stack>
  );
}

