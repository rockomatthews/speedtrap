'use client';

import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

type CaptainTeam = {
  id: string;
  name: string;
  color: string | null;
  captain_name: string | null;
};

export function LeagueCaptainTeamName({ leagueSlug }: { leagueSlug: string }) {
  const [team, setTeam] = useState<CaptainTeam | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function loadCaptainTeam() {
      setLoading(true);
      try {
        const response = await fetch(`/api/leagues/${leagueSlug}/captain/team`, { cache: 'no-store' });
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          if (alive) setTeam(null);
          return;
        }
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Could not load captain team');
        if (alive) {
          setTeam(json.team);
          setName(json.team?.name ?? '');
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Could not load captain team');
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadCaptainTeam();
    return () => {
      alive = false;
    };
  }, [leagueSlug]);

  async function saveTeamName() {
    if (!team) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/leagues/${leagueSlug}/captain/team`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Could not save team name');
      setTeam(json.team);
      setName(json.team.name);
      setMessage('Team name saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save team name');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !team) return null;

  return (
    <Box sx={{ border: '1px solid rgba(255,210,0,0.45)', bgcolor: '#111', p: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'center' }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Box sx={{ width: 12, height: 12, bgcolor: team.color || '#FFD200' }} />
            <Chip label="Captain tools" color="primary" />
          </Stack>
          <Typography variant="h5" sx={{ fontWeight: 1000 }}>
            Name your team
          </Typography>
          <Typography color="text.secondary">As team captain, you can update your team name for the public standings.</Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ minWidth: { md: 520 } }}>
          <TextField label="Team name" value={name} onChange={(event) => setName(event.target.value)} fullWidth />
          <Button variant="contained" disabled={saving || name.trim().length < 2 || name.trim() === team.name} onClick={saveTeamName}>
            Save
          </Button>
        </Stack>
      </Stack>
      {message ? (
        <Alert severity="success" sx={{ mt: 2 }}>
          {message}
        </Alert>
      ) : null}
      {error ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      ) : null}
    </Box>
  );
}
