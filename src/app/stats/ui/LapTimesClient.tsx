'use client';

import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function LapTimesClient() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch('/api/vms/lap-times?index=0&count=50');
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
        if (cancelled) return;
        setData(json);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load lap times.');
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <CircularProgress size={20} />;

  const results = Array.isArray(data.results) ? data.results : [];

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
        <Typography sx={{ fontWeight: 900 }}>Recent lap times</Typography>
        <Typography color="text.secondary">{results.length} results</Typography>
        <pre style={{ margin: 0, fontSize: 12, overflowX: 'auto' }}>
          {JSON.stringify(results.slice(0, 5), null, 2)}
        </pre>
      </Stack>
    </Paper>
  );
}


