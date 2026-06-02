'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { type LocalHotlapEvent } from '@/lib/vms/types';

type LocalEventWithStatus = LocalHotlapEvent & { computedStatus?: string };

function statusColor(status: string) {
  if (status === 'active') return 'success';
  if (status === 'scheduled') return 'info';
  if (status === 'completed') return 'default';
  return 'warning';
}

export function LeaderboardsClient() {
  const [events, setEvents] = useState<LocalEventWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch('/api/vms/hotlap-events');
        const json = (await res.json().catch(() => null)) as { events?: LocalEventWithStatus[]; error?: string } | null;
        if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
        if (!cancelled) setEvents(json?.events ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load leaderboards.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (loading) return <CircularProgress size={22} />;

  if (events.length === 0) {
    return (
      <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        <CardContent>
          <Typography color="text.secondary">No fastest-lap challenges are available yet.</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={1.5}>
      {events.map((event) => {
        const status = event.computedStatus ?? event.status;
        return (
          <Card key={event.id} variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between">
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      {event.name}
                    </Typography>
                    <Chip size="small" label={status} color={statusColor(status) as any} />
                  </Stack>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    {event.start_date} to {event.end_date}
                  </Typography>
                </Box>
                <Button component={Link} href={`/leaderboards/${event.slug}`} variant="contained">
                  View leaderboard
                </Button>
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}
