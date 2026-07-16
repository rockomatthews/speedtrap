'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

type AdminLeague = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  visibility: string;
  team_scoring_count: number;
  league_teams?: Array<{ id: string; name: string; color: string }>;
  league_members?: Array<{ id: string; driver_name: string; vms_customer_id: number; team_id: string | null }>;
  league_rounds?: Array<{
    id: string;
    round_number: number;
    name: string;
    status: string;
    vms_hotlap_events?: { id: string; name: string; vms_hotlap_event_id: number } | null;
  }>;
};

type HotlapEvent = {
  id: string;
  name: string;
  slug: string;
  vms_hotlap_event_id: number;
  circuit_id: number;
  status: string;
};

const defaultLeague = {
  name: '',
  slug: '',
  description: '',
  status: 'draft',
  visibility: 'public',
  teamScoringCount: 2
};

export function AdminLeaguesClient() {
  const [leagues, setLeagues] = useState<AdminLeague[]>([]);
  const [events, setEvents] = useState<HotlapEvent[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState('');
  const [leagueForm, setLeagueForm] = useState(defaultLeague);
  const [teamForm, setTeamForm] = useState({ name: '', color: '#FFD200' });
  const [memberForm, setMemberForm] = useState({ driverName: '', vmsCustomerId: '', teamId: '' });
  const [roundForm, setRoundForm] = useState({
    roundNumber: '1',
    name: '',
    status: 'qualifying',
    carGroup: '',
    circuitName: '',
    qualifyingHotlapEventId: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedLeague = useMemo(() => leagues.find((league) => league.id === selectedLeagueId) ?? leagues[0], [leagues, selectedLeagueId]);

  async function load() {
    setError(null);
    const [leagueResponse, eventResponse] = await Promise.all([fetch('/api/admin/leagues'), fetch('/api/vms/hotlap-events')]);
    const leagueJson = await leagueResponse.json();
    const eventJson = await eventResponse.json();
    if (!leagueResponse.ok) throw new Error(leagueJson.error || 'Could not load leagues');
    if (!eventResponse.ok) throw new Error(eventJson.error || 'Could not load VMS hotlap events');
    setLeagues(leagueJson.leagues ?? []);
    setEvents(eventJson.events ?? []);
    if (!selectedLeagueId && leagueJson.leagues?.[0]) setSelectedLeagueId(leagueJson.leagues[0].id);
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Could not load leagues'));
  }, []);

  async function submit(path: string, body: unknown, success: string) {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Request failed');
      setMessage(success);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  async function createLeague() {
    await submit('/api/admin/leagues', leagueForm, 'League created.');
    setLeagueForm(defaultLeague);
  }

  async function addTeam() {
    if (!selectedLeague) return;
    await submit(`/api/admin/leagues/${selectedLeague.id}`, { action: 'add-team', ...teamForm }, 'Team added.');
    setTeamForm({ name: '', color: '#FFD200' });
  }

  async function addMember() {
    if (!selectedLeague) return;
    await submit(
      `/api/admin/leagues/${selectedLeague.id}`,
      {
        action: 'add-member',
        driverName: memberForm.driverName,
        vmsCustomerId: memberForm.vmsCustomerId,
        teamId: memberForm.teamId || null
      },
      'Driver added.'
    );
    setMemberForm({ driverName: '', vmsCustomerId: '', teamId: '' });
  }

  async function addRound() {
    if (!selectedLeague) return;
    const selectedEvent = events.find((event) => event.id === roundForm.qualifyingHotlapEventId);
    await submit(
      `/api/admin/leagues/${selectedLeague.id}`,
      {
        action: 'add-round',
        roundNumber: roundForm.roundNumber,
        name: roundForm.name,
        status: roundForm.status,
        carGroup: roundForm.carGroup || null,
        circuitId: selectedEvent?.circuit_id ?? null,
        circuitName: roundForm.circuitName || null,
        qualifyingHotlapEventId: roundForm.qualifyingHotlapEventId || null
      },
      'Round added.'
    );
    setRoundForm({ roundNumber: '1', name: '', status: 'qualifying', carGroup: '', circuitName: '', qualifyingHotlapEventId: '' });
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 1000 }}>
            Leagues
          </Typography>
          <Typography color="text.secondary">Build hybrid leagues from VMS hotlap qualifying, teams, and race-night rounds.</Typography>
        </Box>
        <Button component={Link} href="/admin" variant="contained" color="secondary">
          Back to Admin
        </Button>
      </Stack>

      {message ? <Alert severity="success">{message}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Box sx={{ p: 3, border: '1px solid rgba(255,255,255,0.14)', bgcolor: '#111' }}>
            <Typography variant="h5" sx={{ fontWeight: 1000, mb: 2 }}>
              Create League
            </Typography>
            <Stack spacing={2}>
              <TextField label="League name" value={leagueForm.name} onChange={(e) => setLeagueForm({ ...leagueForm, name: e.target.value })} />
              <TextField label="Slug (optional)" value={leagueForm.slug} onChange={(e) => setLeagueForm({ ...leagueForm, slug: e.target.value })} />
              <TextField
                label="Description"
                multiline
                minRows={3}
                value={leagueForm.description}
                onChange={(e) => setLeagueForm({ ...leagueForm, description: e.target.value })}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField select label="Status" fullWidth value={leagueForm.status} onChange={(e) => setLeagueForm({ ...leagueForm, status: e.target.value })}>
                  {['draft', 'active', 'completed', 'archived'].map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Visibility"
                  fullWidth
                  value={leagueForm.visibility}
                  onChange={(e) => setLeagueForm({ ...leagueForm, visibility: e.target.value })}
                >
                  {['public', 'members', 'private'].map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <TextField
                label="Team scoring count"
                type="number"
                value={leagueForm.teamScoringCount}
                onChange={(e) => setLeagueForm({ ...leagueForm, teamScoringCount: Number(e.target.value) })}
              />
              <Button disabled={loading || !leagueForm.name.trim()} onClick={createLeague} variant="contained">
                Create League
              </Button>
            </Stack>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <Stack spacing={3}>
            <Box sx={{ p: 3, border: '1px solid rgba(255,210,0,0.35)', bgcolor: '#111' }}>
              <Typography variant="h5" sx={{ fontWeight: 1000, mb: 2 }}>
                Manage League
              </Typography>
              <Stack spacing={2}>
                <TextField select label="League" value={selectedLeague?.id ?? ''} onChange={(e) => setSelectedLeagueId(e.target.value)}>
                  {leagues.map((league) => (
                    <MenuItem key={league.id} value={league.id}>
                      {league.name}
                    </MenuItem>
                  ))}
                </TextField>
                {selectedLeague ? (
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label={selectedLeague.status} />
                    <Chip label={`${selectedLeague.league_teams?.length ?? 0} teams`} />
                    <Chip label={`${selectedLeague.league_members?.length ?? 0} drivers`} />
                    <Chip label={`${selectedLeague.league_rounds?.length ?? 0} rounds`} />
                    <Button component={Link} href={`/leagues/${selectedLeague.slug}`} size="small">
                      View public page
                    </Button>
                  </Stack>
                ) : null}
              </Stack>
            </Box>

            {selectedLeague ? (
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box sx={{ p: 3, border: '1px solid rgba(255,255,255,0.14)', bgcolor: '#111', height: '100%' }}>
                    <Typography variant="h6" sx={{ fontWeight: 1000, mb: 2 }}>
                      Add Team
                    </Typography>
                    <Stack spacing={2}>
                      <TextField label="Team name" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
                      <TextField label="Color" value={teamForm.color} onChange={(e) => setTeamForm({ ...teamForm, color: e.target.value })} />
                      <Button disabled={loading || !teamForm.name.trim()} onClick={addTeam} variant="contained">
                        Add Team
                      </Button>
                    </Stack>
                  </Box>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Box sx={{ p: 3, border: '1px solid rgba(255,255,255,0.14)', bgcolor: '#111', height: '100%' }}>
                    <Typography variant="h6" sx={{ fontWeight: 1000, mb: 2 }}>
                      Add Driver
                    </Typography>
                    <Stack spacing={2}>
                      <TextField label="Driver name" value={memberForm.driverName} onChange={(e) => setMemberForm({ ...memberForm, driverName: e.target.value })} />
                      <TextField
                        label="VMS customer ID"
                        type="number"
                        value={memberForm.vmsCustomerId}
                        onChange={(e) => setMemberForm({ ...memberForm, vmsCustomerId: e.target.value })}
                      />
                      <TextField select label="Team" value={memberForm.teamId} onChange={(e) => setMemberForm({ ...memberForm, teamId: e.target.value })}>
                        <MenuItem value="">Independent</MenuItem>
                        {(selectedLeague.league_teams ?? []).map((team) => (
                          <MenuItem key={team.id} value={team.id}>
                            {team.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Button disabled={loading || !memberForm.driverName.trim() || !memberForm.vmsCustomerId} onClick={addMember} variant="contained">
                        Add Driver
                      </Button>
                    </Stack>
                  </Box>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Box sx={{ p: 3, border: '1px solid rgba(255,255,255,0.14)', bgcolor: '#111' }}>
                    <Typography variant="h6" sx={{ fontWeight: 1000, mb: 2 }}>
                      Add Round
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 2 }}>
                        <TextField
                          label="Round"
                          type="number"
                          fullWidth
                          value={roundForm.roundNumber}
                          onChange={(e) => setRoundForm({ ...roundForm, roundNumber: e.target.value })}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 5 }}>
                        <TextField label="Round name" fullWidth value={roundForm.name} onChange={(e) => setRoundForm({ ...roundForm, name: e.target.value })} />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 5 }}>
                        <TextField
                          label="Car type / class"
                          fullWidth
                          value={roundForm.carGroup}
                          onChange={(e) => setRoundForm({ ...roundForm, carGroup: e.target.value })}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          select
                          label="Qualifying VMS hotlap event"
                          fullWidth
                          value={roundForm.qualifyingHotlapEventId}
                          onChange={(e) => {
                            const selected = events.find((event) => event.id === e.target.value);
                            setRoundForm({ ...roundForm, qualifyingHotlapEventId: e.target.value, circuitName: selected ? `Circuit #${selected.circuit_id}` : '' });
                          }}
                        >
                          <MenuItem value="">No qualifying event yet</MenuItem>
                          {events.map((event) => (
                            <MenuItem key={event.id} value={event.id}>
                              {event.name} ({event.status})
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          select
                          label="Round status"
                          fullWidth
                          value={roundForm.status}
                          onChange={(e) => setRoundForm({ ...roundForm, status: e.target.value })}
                        >
                          {['draft', 'qualifying', 'race-night', 'completed', 'cancelled'].map((value) => (
                            <MenuItem key={value} value={value}>
                              {value}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Button disabled={loading || !roundForm.name.trim()} onClick={addRound} variant="contained">
                          Add Round
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              </Grid>
            ) : null}
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}
