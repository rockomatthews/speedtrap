'use client';

import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import {
  type LocalHotlapEvent,
  type VmsHotlapEventSummary,
  type VmsHotlapSubEvent
} from '@/lib/vms/types';

type LeaderboardResponse = {
  localEvent: LocalHotlapEvent;
  viewerCustomerId: number | null;
  viewerUsername: string | null;
  joined: boolean;
  entry: { id: string; joined_at: string } | null;
  event: VmsHotlapEventSummary | null;
  subEvents: VmsHotlapSubEvent[];
  error?: string;
};

function RowChip({ label, tone }: { label: string; tone: 'success' | 'warning' | 'default' }) {
  return <Chip size="small" label={label} color={tone} variant={tone === 'default' ? 'outlined' : 'filled'} />;
}

export function LeaderboardDetailClient({ slug }: { slug: string }) {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch(`/api/vms/hotlap-events/${encodeURIComponent(slug)}`);
        const json = (await res.json().catch(() => null)) as LeaderboardResponse | null;
        if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load leaderboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (loading || !data) return <CircularProgress size={22} />;

  async function joinChallenge() {
    setJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/vms/hotlap-events/${encodeURIComponent(slug)}/join`, { method: 'POST' });
      const json = (await res.json().catch(() => null)) as { error?: string; entry?: { id: string; joined_at: string } } | null;
      if (!res.ok) throw new Error(json?.error ?? 'Failed to join challenge.');
      setData((prev) => (prev ? { ...prev, joined: true, entry: json?.entry ?? prev.entry } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join challenge.');
    } finally {
      setJoining(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        <CardContent>
          <Stack spacing={0.5}>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>
              {data.localEvent.name}
            </Typography>
            <Typography color="text.secondary">
              {data.localEvent.start_date} to {data.localEvent.end_date}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
              <Button variant="contained" disabled={!data.viewerUsername || data.joined || joining} onClick={joinChallenge}>
                {!data.viewerUsername ? 'Set username first' : data.joined ? 'Joined' : joining ? 'Joining...' : 'Join challenge'}
              </Button>
              {data.joined ? <Chip label="Run laps at the venue sims to post a time" color="primary" /> : null}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {!data.viewerUsername ? (
        <Alert severity="warning">Create a racing username in the portal before joining this challenge.</Alert>
      ) : data.joined ? (
        <Alert severity="success">
          You are signed up as {data.viewerUsername}. VMS records the laps; this page shows your place when your customer ID appears in results.
        </Alert>
      ) : (
        <Alert severity="info">Join this challenge, then race on the connected sims at Speed Trap to get ranked.</Alert>
      )}

      {data.subEvents.length === 0 ? (
        <Alert severity="info">VMS returned no leaderboard sub-events for this challenge yet.</Alert>
      ) : (
        data.subEvents.map((subEvent, subEventIndex) => (
          <Card key={`${subEvent.id ?? subEvent.name}-${subEventIndex}`} variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
            <CardContent>
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    {subEvent.name}
                  </Typography>
                  <Typography color="text.secondary">
                    {subEvent.circuitName ?? data.event?.circuitName ?? 'Track'} · {subEvent.results.length} driver
                    {subEvent.results.length === 1 ? '' : 's'}
                  </Typography>
                </Box>

                {subEvent.results.length === 0 ? (
                  <Typography color="text.secondary">No eligible laps have been recorded yet.</Typography>
                ) : (
                  <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Rank</TableCell>
                          <TableCell>Driver</TableCell>
                          <TableCell>Lap</TableCell>
                          <TableCell>Vehicle</TableCell>
                          <TableCell>Class</TableCell>
                          <TableCell>Date</TableCell>
                          <TableCell>Venue</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {subEvent.results.map((row) => {
                          const isMine = data.viewerCustomerId !== null && row.customerId === data.viewerCustomerId;
                          return (
                            <TableRow
                              key={`${row.lapId ?? row.rank}-${row.customerId ?? 'driver'}`}
                              sx={{
                                backgroundColor: isMine ? 'rgba(255, 193, 7, 0.14)' : undefined,
                                '& td': { borderColor: 'rgba(255,255,255,0.08)' }
                              }}
                            >
                              <TableCell>{row.rank}</TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <span>{row.customerName ?? 'Driver'}</span>
                                  {isMine ? <Chip size="small" label="You" color="primary" /> : null}
                                </Stack>
                              </TableCell>
                              <TableCell sx={{ fontWeight: 900 }}>{row.lapTimeStr ?? row.lapTimeMs ?? '-'}</TableCell>
                              <TableCell>{row.vehicleName ?? '-'}</TableCell>
                              <TableCell>{row.className ?? '-'}</TableCell>
                              <TableCell>{row.date ?? '-'}</TableCell>
                              <TableCell>{row.venueName ?? '-'}</TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                                  {row.invalid === 1 ? <RowChip label="Invalid" tone="warning" /> : <RowChip label="Valid" tone="success" />}
                                  {row.verified === 1 ? <RowChip label="Verified" tone="success" /> : <RowChip label="Unverified" tone="default" />}
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Stack>
            </CardContent>
          </Card>
        ))
      )}
    </Stack>
  );
}
