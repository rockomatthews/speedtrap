'use client';

import { useEffect, useState } from 'react';

import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

type FormState = {
  email: string;
  requestedAt: string;
  message: string;
  company: string;
};

const emptyForm: FormState = {
  email: '',
  requestedAt: '',
  message: '',
  company: ''
};

function localMinimum() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export function TemporaryBookingDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    function handleBookingLink(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !['/book', '/booking'].includes(url.pathname)) return;

      event.preventDefault();
      setError(null);
      setSent(false);
      setOpen(true);
    }

    document.addEventListener('click', handleBookingLink, true);
    return () => document.removeEventListener('click', handleBookingLink, true);
  }, []);

  function close() {
    if (submitting) return;
    setOpen(false);
    setError(null);
    setSent(false);
    setForm(emptyForm);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(json?.error ?? 'Could not send your reservation request.');
      setSent(true);
      setForm(emptyForm);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not send your reservation request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          bgcolor: '#090909',
          backgroundImage: 'none',
          border: '1px solid rgba(255,210,0,0.58)',
          borderRadius: 1,
          overflow: 'hidden'
        }
      }}
    >
      <Box sx={{ height: 5, background: 'linear-gradient(90deg, #FFD200 0 62%, #FF161F 62%)' }} />
      <DialogTitle sx={{ pr: 7, pt: 3, pb: 1 }}>
        <Typography component="span" variant="h4" sx={{ fontWeight: 950 }}>
          Temporary Booking System
        </Typography>
        <IconButton aria-label="Close reservation form" onClick={close} sx={{ position: 'absolute', right: 14, top: 18 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1, pb: 3 }}>
        {sent ? (
          <Stack spacing={2.5}>
            <Alert severity="success">Your reservation request was sent.</Alert>
            <Typography color="text.secondary">
              The Speed Trap team will follow up at the email address you provided to confirm availability.
            </Typography>
            <Button variant="contained" onClick={close} sx={{ alignSelf: 'flex-start' }}>
              Done
            </Button>
          </Stack>
        ) : (
          <Stack component="form" spacing={2.25} onSubmit={submit}>
            <Typography color="text.secondary">
              Tell us when you would like to race. This request is not confirmed until our team replies.
            </Typography>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField
              required
              fullWidth
              type="email"
              label="Email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              autoComplete="email"
            />
            <TextField
              required
              fullWidth
              type="datetime-local"
              label="Time you would like to visit"
              value={form.requestedAt}
              onChange={(event) => setForm((current) => ({ ...current, requestedAt: event.target.value }))}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { min: localMinimum() }
              }}
            />
            <TextField
              required
              fullWidth
              multiline
              minRows={4}
              label="Message"
              placeholder="eg: we would like to reserve an hour on this date at 6PM"
              value={form.message}
              onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
            />
            <Box
              aria-hidden="true"
              sx={{
                position: 'absolute',
                width: 1,
                height: 1,
                overflow: 'hidden',
                clip: 'rect(0 0 0 0)'
              }}
            >
              <TextField
                label="Company"
                value={form.company}
                onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}
                tabIndex={-1}
                autoComplete="off"
              />
            </Box>
            <Button type="submit" variant="contained" size="large" disabled={submitting} sx={{ alignSelf: 'flex-start', minWidth: 170 }}>
              {submitting ? <CircularProgress size={22} color="inherit" /> : 'Request a reservation'}
            </Button>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
