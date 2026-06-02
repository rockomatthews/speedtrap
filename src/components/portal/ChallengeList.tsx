'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
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

export function ChallengeList({ username }: { username?: string | null }) {
  const [events, setEvents] = useState<LocalEventWithStatus[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/vms/hotlap-events');
      const json = (await res.json().catch(() => null)) as { events?: LocalEventWithStatus[]; error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? 'Failed to load challenges.');
      const nextEvents = json?.events ?? [];
      setEvents(nextEvents);

      const joined = new Set<string>();
      await Promise.all(
        nextEvents.map(async (event) => {
          const entryRes = await fetch(`/api/vms/hotlap-events/${encodeURIComponent(event.slug)}/entry`);
          if (!entryRes.ok) return;
          const entryJson = (await entryRes.json().catch(() => null)) as { joined?: boolean } | null;
          if (entryJson?.joined) joined.add(event.id);
        })
      );
      setJoinedIds(joined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load challenges.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function join(event: LocalEventWithStatus) {
    setJoining(event.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/vms/hotlap-events/${encodeURIComponent(event.slug)}/join`, { method: 'POST' });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? 'Failed to join challenge.');
      setJoinedIds((prev) => new Set([...prev, event.id]));
      setMessage(`You joined ${event.name}. Run laps at the venue sims and VMS will score the board.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join challenge.');
    } finally {
      setJoining(null);
    }
  }

  if (loading) return <CircularProgress size={22} />;

  return (
    <Stack spacing={1.5}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {message ? <Alert severity="success">{message}</Alert> : null}
      {events.length === 0 ? (
        <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
          <CardContent>
            <Typography sx={{ fontWeight: 900 }}>No active challenges yet</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Once staff creates a VMS hotlap challenge, it will appear here for signup and leaderboard tracking.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        events.map((event) => {
          const status = event.computedStatus ?? event.status;
          const joined = joinedIds.has(event.id);
          return (
            <Card key={event.id} variant="outlined" sx={{ borderColor: joined ? 'rgba(255,210,0,0.45)' : 'rgba(255,255,255,0.12)' }}>
              <CardContent>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between">
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        {event.name}
                      </Typography>
                      <Chip size="small" label={status} color={statusColor(status) as any} />
                      {joined ? <Chip size="small" label="Joined" color="primary" /> : null}
                    </Stack>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      {event.start_date} to {event.end_date}
                    </Typography>
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button component={Link} href={`/leaderboards/${event.slug}`} variant="outlined">
                      Leaderboard
                    </Button>
                    <Button
                      variant="contained"
                      disabled={!username || joined || joining === event.id || status === 'completed' || status === 'cancelled'}
                      onClick={() => join(event)}
                    >
                      {!username ? 'Set username first' : joined ? 'Joined' : joining === event.id ? 'Joining...' : 'Join challenge'}
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          );
        })
      )}
    </Stack>
  );
}
