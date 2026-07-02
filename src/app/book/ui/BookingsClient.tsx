'use client';

import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type Booking = {
  id: number;
  eventName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  venueName?: string | null;
  eventActivity?: string | null;
  groupSize?: number | null;
  numberOfPods?: number | null;
};

function formatBookingDate(value?: string | null) {
  if (!value) return 'Time pending';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

export function BookingsClient() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch('/api/vms/bookings?past=1&future=1');
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
        if (cancelled) return;
        setData(json);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load bookings.');
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <CircularProgress size={20} />;

  const results: Booking[] = Array.isArray(data.results) ? data.results : [];

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: '1px solid rgba(255,255,255,0.10)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))'
      }}
    >
      <Stack spacing={1}>
        <Typography sx={{ fontWeight: 900 }}>My VMS bookings</Typography>
        {results.length ? (
          <Stack spacing={1.25}>
            {results.slice(0, 5).map((booking) => (
              <Box
                key={booking.id}
                sx={{
                  p: 1.5,
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 2,
                  backgroundColor: 'rgba(0,0,0,0.24)'
                }}
              >
                <Stack spacing={0.75}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                    <Typography sx={{ flex: 1, fontWeight: 900 }}>
                      {booking.eventName || 'Speed Trap Race'}
                    </Typography>
                    <Chip
                      size="small"
                      label={booking.status || 'Booked'}
                      sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, fontWeight: 900 }}
                    />
                  </Stack>
                  <Typography color="text.secondary">
                    {formatBookingDate(booking.startDate)}
                    {booking.endDate ? ` - ${formatBookingDate(booking.endDate)}` : ''}
                  </Typography>
                  <Typography color="text.secondary">
                    {[booking.eventActivity, booking.venueName, `${booking.numberOfPods ?? booking.groupSize ?? 1} pod${(booking.numberOfPods ?? booking.groupSize ?? 1) === 1 ? '' : 's'}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary">No VMS bookings yet.</Typography>
        )}
      </Stack>
    </Paper>
  );
}

