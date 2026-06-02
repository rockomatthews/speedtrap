'use client';

import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

type PaidSession = {
  id: string;
  toast_order_guid: string;
  vms_booking_id: number | null;
  customer_name: string | null;
  session_quantity: number;
  session_minutes: number;
  status: 'received' | 'ignored' | 'processing' | 'booked' | 'failed';
  ignored_reason: string | null;
  error: string | null;
  processed_at: string | null;
  created_at: string;
};

function statusColor(status: PaidSession['status']) {
  if (status === 'booked') return 'success';
  if (status === 'processing' || status === 'received') return 'info';
  if (status === 'failed') return 'error';
  return 'default';
}

export function PaidSessionsList() {
  const [sessions, setSessions] = useState<PaidSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/toast/session-orders');
        const json = (await res.json().catch(() => null)) as { sessions?: PaidSession[]; error?: string } | null;
        if (!res.ok) throw new Error(json?.error ?? 'Failed to load paid sessions.');
        if (!cancelled) setSessions(json?.sessions ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load paid sessions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <CircularProgress size={22} />;

  return (
    <Stack spacing={1.5}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {sessions.length === 0 ? (
        <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
          <CardContent>
            <Typography sx={{ fontWeight: 900 }}>No paid race sessions yet</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Paid Toast racing sessions will appear here once the Toast webhook is connected.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        sessions.map((session) => (
          <Card key={session.id} variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
            <CardContent>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between">
                <Stack spacing={0.5}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography sx={{ fontWeight: 900 }}>
                      {session.session_quantity} x {session.session_minutes} min sim session
                    </Typography>
                    <Chip size="small" label={session.status} color={statusColor(session.status) as any} />
                  </Stack>
                  <Typography color="text.secondary">
                    {session.vms_booking_id ? `VMS booking #${session.vms_booking_id}` : `Toast order ${session.toast_order_guid}`}
                  </Typography>
                  {session.error || session.ignored_reason ? (
                    <Typography color={session.error ? 'error.main' : 'text.secondary'}>{session.error ?? session.ignored_reason}</Typography>
                  ) : null}
                </Stack>
                <Typography color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {new Date(session.processed_at ?? session.created_at).toLocaleString()}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ))
      )}
    </Stack>
  );
}
