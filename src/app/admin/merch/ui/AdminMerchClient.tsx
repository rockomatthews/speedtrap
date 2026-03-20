'use client';

import { useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

type AdminMerchItem = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_cents: number;
  currency: string;
  active: boolean;
};

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
  const [createActive, setCreateActive] = useState(true);
  const [createImage, setCreateImage] = useState<File | null>(null);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCurrency, setEditCurrency] = useState('usd');
  const [editActive, setEditActive] = useState(true);
  const [editImage, setEditImage] = useState<File | null>(null);
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
            <Button variant="outlined" component="label">
              {createImage ? `Image: ${createImage.name}` : 'Upload image'}
              <input
                hidden
                type="file"
                accept="image/*"
                onChange={(e) => setCreateImage(e.target.files?.[0] ?? null)}
              />
            </Button>
            <FormControlLabel
              control={<Switch checked={createActive} onChange={(_, v) => setCreateActive(v)} />}
              label="Active (visible on merch page)"
            />

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
                  form.set('active', String(createActive));
                  if (createImage) form.set('image', createImage);

                  const res = await fetch('/api/admin/merch', { method: 'POST', body: form });
                  const json = (await res.json().catch(() => null)) as { error?: string } | null;
                  if (!res.ok) throw new Error(json?.error ?? 'Failed to create merch item.');

                  setCreateTitle('');
                  setCreateDescription('');
                  setCreatePrice('');
                  setCreateCurrency('usd');
                  setCreateImage(null);
                  setCreateActive(true);
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
                        setEditActive(item.active);
                        setEditImage(null);
                      }}
                    >
                      {editingId === item.id ? 'Close' : 'Edit'}
                    </Button>
                  </Stack>

                  {item.image_url ? (
                    <Box
                      component="img"
                      src={item.image_url}
                      alt={item.name}
                      sx={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 1 }}
                    />
                  ) : null}

                  <Typography color="text.secondary">
                    {item.description || 'No description'} | {item.currency.toUpperCase()} {centsToDisplay(item.price_cents)} |{' '}
                    {item.active ? 'Active' : 'Inactive'}
                  </Typography>

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
                      <Button variant="outlined" component="label">
                        {editImage ? `New image: ${editImage.name}` : 'Upload new image'}
                        <input
                          hidden
                          type="file"
                          accept="image/*"
                          onChange={(e) => setEditImage(e.target.files?.[0] ?? null)}
                        />
                      </Button>
                      <FormControlLabel
                        control={<Switch checked={editActive} onChange={(_, v) => setEditActive(v)} />}
                        label="Active"
                      />

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
                            form.set('active', String(editActive));
                            if (editImage) form.set('image', editImage);

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

