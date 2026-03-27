'use client';

import { useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Checkbox from '@mui/material/Checkbox';

type AdminMerchItem = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  image_urls?: string[] | null;
  price_cents: number;
  inventory_count: number;
  sizes?: string[] | null;
  size_inventory?: Record<string, number> | null;
  currency: string;
  active: boolean;
};
const SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const;

function centsToDisplay(cents: number) {
  return (cents / 100).toFixed(2);
}

export function AdminMerchClient() {
  const [items, setItems] = useState<AdminMerchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createPrice, setCreatePrice] = useState('');
  const [createCurrency, setCreateCurrency] = useState('usd');
  const [createInventory, setCreateInventory] = useState('0');
  const [createActive, setCreateActive] = useState(true);
  const [createSizes, setCreateSizes] = useState<string[]>([]);
  const [createSizeInventory, setCreateSizeInventory] = useState<Record<string, string>>({});
  const [createImages, setCreateImages] = useState<File[]>([]);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCurrency, setEditCurrency] = useState('usd');
  const [editInventory, setEditInventory] = useState('0');
  const [editActive, setEditActive] = useState(true);
  const [editSizes, setEditSizes] = useState<string[]>([]);
  const [editSizeInventory, setEditSizeInventory] = useState<Record<string, string>>({});
  const [editImages, setEditImages] = useState<File[]>([]);
  const [editKeepImageUrls, setEditKeepImageUrls] = useState<string[]>([]);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  async function loadItems() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/merch');
      const json = (await res.json().catch(() => null)) as { items?: AdminMerchItem[]; error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? 'Failed to load merch.');
      setItems(json?.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load merch.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  const editingItem = useMemo(() => items.find((i) => i.id === editingId) ?? null, [editingId, items]);

  return (
    <Stack spacing={2}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {message ? <Alert severity="success">{message}</Alert> : null}

      <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        <CardContent>
          <Stack spacing={1.25}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Create merch item
            </Typography>

            <TextField
              label="Title"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="Hoodie"
            />
            <TextField
              label="Description"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              multiline
              minRows={2}
            />
            <TextField
              label="Price (USD)"
              value={createPrice}
              onChange={(e) => setCreatePrice(e.target.value)}
              placeholder="49.99"
              inputMode="decimal"
            />
            <TextField
              label="Currency"
              value={createCurrency}
              onChange={(e) => setCreateCurrency(e.target.value)}
              placeholder="usd"
            />
            <TextField
              label="Inventory count"
              value={createInventory}
              onChange={(e) => setCreateInventory(e.target.value)}
              placeholder="10"
              inputMode="numeric"
            />
            <Button variant="outlined" component="label">
              {createImages.length > 0 ? `${createImages.length} image(s) selected` : 'Upload images'}
              <input
                hidden
                multiple
                type="file"
                accept="image/*"
                onChange={(e) => setCreateImages(Array.from(e.target.files ?? []))}
              />
            </Button>
            <FormControlLabel
              control={<Switch checked={createActive} onChange={(_, v) => setCreateActive(v)} />}
              label="Active (visible on merch page)"
            />
            <FormGroup row>
              {SIZES.map((size) => (
                <FormControlLabel
                  key={size}
                  control={
                    <Checkbox
                      checked={createSizes.includes(size)}
                      onChange={(_, checked) =>
                        setCreateSizes((prev) =>
                          checked ? Array.from(new Set([...prev, size])) : prev.filter((s) => s !== size)
                        )
                      }
                    />
                  }
                  label={size}
                />
              ))}
            </FormGroup>
            {createSizes.length > 0 ? (
              <Stack spacing={1}>
                <Typography color="text.secondary">Per-size inventory</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {createSizes.map((size) => (
                    <TextField
                      key={size}
                      size="small"
                      label={size}
                      value={createSizeInventory[size] ?? '0'}
                      onChange={(e) =>
                        setCreateSizeInventory((prev) => ({
                          ...prev,
                          [size]: e.target.value
                        }))
                      }
                      inputMode="numeric"
                      sx={{ width: 110 }}
                    />
                  ))}
                </Stack>
              </Stack>
            ) : null}

            <Button
              variant="contained"
              disabled={submittingCreate}
              onClick={async () => {
                setSubmittingCreate(true);
                setError(null);
                setMessage(null);
                try {
                  const form = new FormData();
                  form.set('title', createTitle);
                  form.set('description', createDescription);
                  form.set('price', createPrice);
                  form.set('currency', createCurrency || 'usd');
                  form.set('inventory', createInventory);
                  form.set('active', String(createActive));
                  createSizes.forEach((s) => form.append('sizes', s));
                  createSizes.forEach((s) => form.set(`size_inventory_${s.toLowerCase()}`, createSizeInventory[s] ?? '0'));
                  createImages.forEach((img) => form.append('images', img));

                  const res = await fetch('/api/admin/merch', { method: 'POST', body: form });
                  const json = (await res.json().catch(() => null)) as { error?: string } | null;
                  if (!res.ok) throw new Error(json?.error ?? 'Failed to create merch item.');

                  setCreateTitle('');
                  setCreateDescription('');
                  setCreatePrice('');
                  setCreateCurrency('usd');
                  setCreateInventory('0');
                  setCreateImages([]);
                  setCreateActive(true);
                  setCreateSizes([]);
                  setCreateSizeInventory({});
                  setMessage('Merch item created.');
                  await loadItems();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Failed to create merch item.');
                } finally {
                  setSubmittingCreate(false);
                }
              }}
            >
              {submittingCreate ? <CircularProgress size={18} /> : 'Create item'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ fontWeight: 900 }}>
        Existing items
      </Typography>

      {loading ? (
        <CircularProgress size={22} />
      ) : items.length === 0 ? (
        <Typography color="text.secondary">No merch items yet.</Typography>
      ) : (
        <Stack spacing={2}>
          {items.map((item) => (
            <Card key={item.id} variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
              <CardContent>
                <Stack spacing={1.25}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontWeight: 900 }}>{item.name}</Typography>
                    <Button
                      variant={editingId === item.id ? 'contained' : 'outlined'}
                      onClick={() => {
                        if (editingId === item.id) {
                          setEditingId(null);
                          return;
                        }
                        setEditingId(item.id);
                        setEditTitle(item.name);
                        setEditDescription(item.description ?? '');
                        setEditPrice(centsToDisplay(item.price_cents));
                        setEditCurrency(item.currency);
                        setEditInventory(String(item.inventory_count));
                        setEditActive(item.active);
                        setEditSizes(Array.isArray(item.sizes) ? item.sizes.map((s) => String(s).toUpperCase()) : []);
                        const sizeInv = item.size_inventory && typeof item.size_inventory === 'object' ? item.size_inventory : {};
                        setEditSizeInventory(
                          Object.fromEntries(
                            Object.entries(sizeInv).map(([k, v]) => [String(k).toUpperCase(), String(v ?? '0')])
                          )
                        );
                        setEditImages([]);
                        setEditKeepImageUrls(Array.isArray(item.image_urls) ? item.image_urls.map((u) => String(u)) : []);
                      }}
                    >
                      {editingId === item.id ? 'Close' : 'Edit'}
                    </Button>
                  </Stack>

                  {Array.isArray(item.image_urls) && item.image_urls.length > 0 ? (
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                      {item.image_urls.map((u) => (
                        <Box
                          key={u}
                          component="img"
                          src={u}
                          alt={item.name}
                          sx={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 1 }}
                        />
                      ))}
                    </Stack>
                  ) : item.image_url ? (
                    <Box
                      component="img"
                      src={item.image_url}
                      alt={item.name}
                      sx={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 1 }}
                    />
                  ) : null}

                  <Typography color="text.secondary">
                    {item.description || 'No description'} | {item.currency.toUpperCase()} {centsToDisplay(item.price_cents)} |{' '}
                    Stock: {item.inventory_count} | {item.active ? 'Active' : 'Inactive'}
                  </Typography>
                  {Array.isArray(item.sizes) && item.sizes.length > 0 ? (
                    <Typography color="text.secondary">Sizes: {item.sizes.join(', ')}</Typography>
                  ) : null}

                  {editingId === item.id && editingItem ? (
                    <Stack spacing={1.25} sx={{ pt: 1 }}>
                      <TextField label="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                      <TextField
                        label="Description"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        multiline
                        minRows={2}
                      />
                      <TextField
                        label="Price"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        inputMode="decimal"
                      />
                      <TextField
                        label="Currency"
                        value={editCurrency}
                        onChange={(e) => setEditCurrency(e.target.value)}
                      />
                      <TextField
                        label="Inventory count"
                        value={editInventory}
                        onChange={(e) => setEditInventory(e.target.value)}
                        inputMode="numeric"
                      />
                      <Button variant="outlined" component="label">
                        {editImages.length > 0 ? `${editImages.length} new image(s)` : 'Upload new images'}
                        <input
                          hidden
                          multiple
                          type="file"
                          accept="image/*"
                          onChange={(e) => setEditImages(Array.from(e.target.files ?? []))}
                        />
                      </Button>
                      <Typography color="text.secondary">Keep existing images</Typography>
                      <FormGroup row>
                        {(Array.isArray(item.image_urls) ? item.image_urls : []).map((u) => (
                          <FormControlLabel
                            key={u}
                            control={
                              <Checkbox
                                checked={editKeepImageUrls.includes(u)}
                                onChange={(_, checked) =>
                                  setEditKeepImageUrls((prev) =>
                                    checked ? Array.from(new Set([...prev, u])) : prev.filter((x) => x !== u)
                                  )
                                }
                              />
                            }
                            label="Keep"
                          />
                        ))}
                      </FormGroup>
                      <FormControlLabel
                        control={<Switch checked={editActive} onChange={(_, v) => setEditActive(v)} />}
                        label="Active"
                      />
                      <FormGroup row>
                        {SIZES.map((size) => (
                          <FormControlLabel
                            key={size}
                            control={
                              <Checkbox
                                checked={editSizes.includes(size)}
                                onChange={(_, checked) =>
                                  setEditSizes((prev) =>
                                    checked ? Array.from(new Set([...prev, size])) : prev.filter((s) => s !== size)
                                  )
                                }
                              />
                            }
                            label={size}
                          />
                        ))}
                      </FormGroup>
                      {editSizes.length > 0 ? (
                        <Stack spacing={1}>
                          <Typography color="text.secondary">Per-size inventory</Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap">
                            {editSizes.map((size) => (
                              <TextField
                                key={size}
                                size="small"
                                label={size}
                                value={editSizeInventory[size] ?? '0'}
                                onChange={(e) =>
                                  setEditSizeInventory((prev) => ({
                                    ...prev,
                                    [size]: e.target.value
                                  }))
                                }
                                inputMode="numeric"
                                sx={{ width: 110 }}
                              />
                            ))}
                          </Stack>
                        </Stack>
                      ) : null}

                      <Button
                        variant="contained"
                        disabled={submittingEdit}
                        onClick={async () => {
                          setSubmittingEdit(true);
                          setError(null);
                          setMessage(null);
                          try {
                            const form = new FormData();
                            form.set('id', item.id);
                            form.set('title', editTitle);
                            form.set('description', editDescription);
                            form.set('price', editPrice);
                            form.set('currency', editCurrency || 'usd');
                            form.set('inventory', editInventory);
                            form.set('active', String(editActive));
                            editSizes.forEach((s) => form.append('sizes', s));
                            editSizes.forEach((s) => form.set(`size_inventory_${s.toLowerCase()}`, editSizeInventory[s] ?? '0'));
                            editKeepImageUrls.forEach((u) => form.append('keep_image_urls', u));
                            editImages.forEach((img) => form.append('images', img));

                            const res = await fetch('/api/admin/merch', { method: 'PATCH', body: form });
                            const json = (await res.json().catch(() => null)) as { error?: string } | null;
                            if (!res.ok) throw new Error(json?.error ?? 'Failed to update merch item.');

                            setMessage('Merch item updated.');
                            await loadItems();
                          } catch (e) {
                            setError(e instanceof Error ? e.message : 'Failed to update merch item.');
                          } finally {
                            setSubmittingEdit(false);
                          }
                        }}
                      >
                        {submittingEdit ? <CircularProgress size={18} /> : 'Save changes'}
                      </Button>

                      <Button
                        color="error"
                        variant="outlined"
                        disabled={submittingEdit}
                        onClick={async () => {
                          const confirmed = window.confirm(`Delete "${item.name}"? This cannot be undone.`);
                          if (!confirmed) return;
                          setSubmittingEdit(true);
                          setError(null);
                          setMessage(null);
                          try {
                            const res = await fetch('/api/admin/merch', {
                              method: 'DELETE',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: item.id })
                            });
                            const json = (await res.json().catch(() => null)) as { error?: string } | null;
                            if (!res.ok) throw new Error(json?.error ?? 'Failed to delete merch item.');
                            setMessage('Merch item deleted.');
                            setEditingId(null);
                            await loadItems();
                          } catch (e) {
                            setError(e instanceof Error ? e.message : 'Failed to delete merch item.');
                          } finally {
                            setSubmittingEdit(false);
                          }
                        }}
                      >
                        Delete item
                      </Button>
                    </Stack>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

