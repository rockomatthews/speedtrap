'use client';

import { useEffect, useMemo, useState } from 'react';

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
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteIcon from '@mui/icons-material/Delete';

import type { MerchItem } from '../merch-items';

type CartLine = {
  key: string;
  itemId: string;
  name: string;
  priceId: string;
  size: string | null;
  quantity: number;
  unitPriceCents: number;
  currency: string;
};

type CartPreview = {
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  note?: string;
};

const CART_STORAGE_KEY = 'speedtrap_merch_cart_v1';

function isCartPreview(value: unknown): value is CartPreview {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.subtotalCents === 'number' &&
    typeof v.shippingCents === 'number' &&
    typeof v.taxCents === 'number' &&
    typeof v.totalCents === 'number' &&
    typeof v.currency === 'string'
  );
}

export function MerchClient({ items }: { items: MerchItem[] }) {
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<CartLine[]>([]);
  const [preview, setPreview] = useState<CartPreview | null>(null);

  const cartTotalCents = cart.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const cartCurrency = cart[0]?.currency ?? 'usd';

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CartLine[];
      if (Array.isArray(parsed)) setCart(parsed);
    } catch {
      // ignore corrupt storage
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // best-effort persistence
    }
  }, [cart]);

  useEffect(() => {
    if (cart.length === 0) {
      setPreview(null);
      return;
    }
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch('/api/stripe/checkout-session', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart.map((line) => ({ priceId: line.priceId, quantity: line.quantity, size: line.size }))
          }),
          signal: controller.signal
        });
        const data = (await res.json().catch(() => null)) as CartPreview | { error?: string } | null;
        if (!res.ok || !data || !isCartPreview(data)) return;
        setPreview(data);
      } catch {
        // silent preview failure; checkout validation still happens server-side
      }
    })();
    return () => controller.abort();
  }, [cart]);

  const availableByItemAndSize = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const sizes = Array.isArray(item.sizes) ? item.sizes.map((s) => String(s).toUpperCase()) : [];
      if (sizes.length === 0) {
        map.set(`${item.id}::-`, Math.max(0, item.inventoryCount ?? 0));
      } else {
        const invObj =
          item.sizeInventory && typeof item.sizeInventory === 'object'
            ? (item.sizeInventory as Record<string, unknown>)
            : {};
        for (const size of sizes) {
          const n = Number(invObj[size]);
          map.set(`${item.id}::${size}`, Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
        }
      }
    }
    return map;
  }, [items]);

  const cartQtyByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cart) map.set(line.key, (map.get(line.key) ?? 0) + line.quantity);
    return map;
  }, [cart]);

  return (
    <Stack spacing={2}>
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
        {items.map((item) => {
          const stock = item.inventoryCount ?? 0;
          const sizes = Array.isArray(item.sizes) ? item.sizes.map((s) => String(s).toUpperCase()) : [];
          const selectedSize = selectedSizes[item.id] ?? '';
          const inStock = sizes.length > 0 ? sizes.some((s) => (availableByItemAndSize.get(`${item.id}::${s}`) ?? 0) > 0) : stock > 0;

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
                {sizes.length > 0 ? (
                  <Stack spacing={1} sx={{ mt: 1.5 }}>
                    <FormControl size="small">
                      <InputLabel>Size</InputLabel>
                      <Select
                        label="Size"
                        value={selectedSize}
                        onChange={(e) =>
                          setSelectedSizes((prev) => ({
                            ...prev,
                            [item.id]: String(e.target.value)
                          }))
                        }
                      >
                        {sizes.map((size) => {
                          const available = availableByItemAndSize.get(`${item.id}::${size}`) ?? 0;
                          return (
                          <MenuItem key={size} value={size} disabled={available <= 0}>
                            {size} {available > 0 ? `(${available})` : '(out)'}
                          </MenuItem>
                        )})}
                      </Select>
                    </FormControl>
                    <Stack direction="row" spacing={0.5}>
                      {sizes.map((size) => (
                        <Chip key={size} size="small" label={size} />
                      ))}
                    </Stack>
                  </Stack>
                ) : null}
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2 }}>
                <Button
                  variant="contained"
                  size="large"
                  disabled={!inStock}
                  onClick={() => {
                    setError(null);
                    if (sizes.length > 0 && !selectedSize) {
                      setError(`Please select a size for ${item.name}.`);
                      return;
                    }
                    const size = sizes.length > 0 ? selectedSize : null;
                    const key = `${item.id}::${size ?? '-'}`;
                    const available = availableByItemAndSize.get(key) ?? 0;
                    const alreadyInCart = cartQtyByKey.get(key) ?? 0;
                    if (available <= alreadyInCart) {
                      setError(`No more stock available for ${item.name}${size ? ` (${size})` : ''}.`);
                      return;
                    }
                    const unitPriceCents = typeof item.priceCents === 'number' ? item.priceCents : 0;
                    const currency = item.currency ?? 'usd';

                    setCart((prev) => {
                      const idx = prev.findIndex((line) => line.key === key);
                      if (idx === -1) {
                        return [
                          ...prev,
                          {
                            key,
                            itemId: item.id,
                            name: item.name,
                            priceId: item.priceId,
                            size,
                            quantity: 1,
                            unitPriceCents,
                            currency
                          }
                        ];
                      }
                      const next = [...prev];
                      next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
                      return next;
                    });
                  }}
                >
                  Add to Cart
                </Button>
              </CardActions>
            </Card>
          );
        })}
      </Box>

      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderColor: 'rgba(255,255,255,0.12)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))'
        }}
      >
        <Stack spacing={1.25}>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            Cart
          </Typography>
          {cart.length === 0 ? (
            <Typography color="text.secondary">Your cart is empty.</Typography>
          ) : (
            <Stack spacing={1}>
              {cart.map((line) => (
                <Stack key={line.key} spacing={0.75}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography>
                      {line.name}
                      {line.size ? ` (${line.size})` : ''}
                    </Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <IconButton
                        size="small"
                        onClick={() =>
                          setCart((prev) =>
                            prev
                              .map((p) => (p.key === line.key ? { ...p, quantity: Math.max(1, p.quantity - 1) } : p))
                              .filter((p) => p.quantity > 0)
                          )
                        }
                      >
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                      <Typography sx={{ minWidth: 22, textAlign: 'center' }}>{line.quantity}</Typography>
                      <IconButton
                        size="small"
                        onClick={() => {
                          const available = availableByItemAndSize.get(line.key) ?? 0;
                          if (line.quantity >= available) return;
                          setCart((prev) => prev.map((p) => (p.key === line.key ? { ...p, quantity: p.quantity + 1 } : p)));
                        }}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => setCart((prev) => prev.filter((p) => p.key !== line.key))}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>
                  <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                    {(line.currency ?? 'usd').toUpperCase()} {(line.unitPriceCents / 100).toFixed(2)} each
                  </Typography>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                </Stack>
              ))}
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pt: 0.5 }}>
                <Typography sx={{ fontWeight: 900 }}>
                  Total: {cartCurrency.toUpperCase()} {(cartTotalCents / 100).toFixed(2)}
                </Typography>
                <Button
                  variant="contained"
                  disabled={checkingOut || cart.length === 0}
                  onClick={async () => {
                    setError(null);
                    setCheckingOut(true);
                    try {
                      const res = await fetch('/api/stripe/checkout-session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          items: cart.map((line) => ({
                            priceId: line.priceId,
                            quantity: line.quantity,
                            size: line.size
                          }))
                        })
                      });
                      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
                      if (!res.ok || !data?.url) throw new Error(data?.error ?? 'Failed to start checkout.');
                      window.location.href = data.url;
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Failed to start checkout.');
                      setCheckingOut(false);
                    }
                  }}
                >
                  {checkingOut ? <CircularProgress size={18} /> : 'Checkout'}
                </Button>
              </Stack>
              {preview ? (
                <Stack spacing={0.25} sx={{ pt: 0.75 }}>
                  <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                    Subtotal: {preview.currency.toUpperCase()} {(preview.subtotalCents / 100).toFixed(2)}
                  </Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                    Est. Shipping: {preview.currency.toUpperCase()} {(preview.shippingCents / 100).toFixed(2)}
                  </Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                    Est. Tax: {preview.currency.toUpperCase()} {(preview.taxCents / 100).toFixed(2)}
                  </Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: 14 }}>
                    Est. Total: {preview.currency.toUpperCase()} {(preview.totalCents / 100).toFixed(2)}
                  </Typography>
                  {preview.note ? (
                    <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                      {preview.note}
                    </Typography>
                  ) : null}
                </Stack>
              ) : null}
            </Stack>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}

