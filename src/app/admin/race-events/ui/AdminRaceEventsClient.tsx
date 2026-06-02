'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { type LocalHotlapEvent, type VmsCatalog } from '@/lib/vms/types';

type SubEventDraft = {
  name: string;
  vehicleIds: number[];
  classIds: number[];
};

type LocalEventWithStatus = LocalHotlapEvent & { computedStatus?: string };

const defaultSubEvent: SubEventDraft = { name: 'Overall', vehicleIds: [], classIds: [] };

function parseNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function AdminRaceEventsClient() {
  const [catalog, setCatalog] = useState<VmsCatalog | null>(null);
  const [events, setEvents] = useState<LocalEventWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [circuitId, setCircuitId] = useState('');
  const [venueIds, setVenueIds] = useState<number[]>([]);
  const [qualificationPercentage, setQualificationPercentage] = useState('');
  const [subEvents, setSubEvents] = useState<SubEventDraft[]>([defaultSubEvent]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [catalogRes, eventsRes] = await Promise.all([fetch('/api/vms/catalog'), fetch('/api/vms/hotlap-events')]);
      const catalogJson = (await catalogRes.json().catch(() => null)) as (VmsCatalog & { error?: string }) | null;
      const eventsJson = (await eventsRes.json().catch(() => null)) as
        | { events?: LocalEventWithStatus[]; error?: string }
        | null;

      if (!catalogRes.ok) throw new Error(catalogJson?.error ?? 'Failed to load VMS catalog.');
      if (!eventsRes.ok) throw new Error(eventsJson?.error ?? 'Failed to load race events.');

      setCatalog(catalogJson);
      setEvents(eventsJson?.events ?? []);

      const firstCircuit = catalogJson?.circuits?.[0]?.id;
      if (!circuitId && firstCircuit) setCircuitId(String(firstCircuit));

      const homeVenue = catalogJson?.venues?.[0]?.id;
      if (venueIds.length === 0 && homeVenue) setVenueIds([homeVenue]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load race event tools.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const circuitOptions = catalog?.circuits ?? [];
  const venueOptions = catalog?.venues ?? [];
  const vehicleOptions = catalog?.vehicles ?? [];
  const classOptions = catalog?.classes ?? [];

  const canSubmit = useMemo(
    () => name.trim().length >= 3 && startDate && endDate && parseNumber(circuitId) > 0 && venueIds.length > 0,
    [circuitId, endDate, name, startDate, venueIds.length]
  );

  function toggleSubEventOption(index: number, field: 'vehicleIds' | 'classIds', id: number, checked: boolean) {
    setSubEvents((prev) =>
      prev.map((subEvent, i) => {
        if (i !== index) return subEvent;
        const next = checked ? Array.from(new Set([...subEvent[field], id])) : subEvent[field].filter((value) => value !== id);
        return { ...subEvent, [field]: next };
      })
    );
  }

  async function createEvent() {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/vms/admin/hotlap-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          startDate,
          endDate,
          circuitId: parseNumber(circuitId),
          venueIds,
          qualificationPercentage: qualificationPercentage ? parseNumber(qualificationPercentage) : null,
          subEvents: subEvents.map((subEvent) => ({
            name: subEvent.name,
            vehicleIds: subEvent.vehicleIds,
            classIds: subEvent.classIds
          }))
        })
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? 'Failed to create race event.');

      setName('');
      setStartDate('');
      setEndDate('');
      setQualificationPercentage('');
      setSubEvents([defaultSubEvent]);
      setMessage('Race event created in VMS and linked to the site.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create race event.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <CircularProgress size={22} />;

  return (
    <Stack spacing={2}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {message ? <Alert severity="success">{message}</Alert> : null}

      <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Create hotlap challenge
            </Typography>
            <TextField label="Event name" value={name} onChange={(e) => setName(e.target.value)} placeholder="June Fastest Lap" />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <TextField
                label="Start"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="End"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
            <TextField select SelectProps={{ native: true }} label="Track" value={circuitId} onChange={(e) => setCircuitId(e.target.value)}>
              <option value="">Select a track</option>
              {circuitOptions.map((circuit) => (
                <option key={circuit.id} value={circuit.id}>
                  {circuit.name}
                </option>
              ))}
            </TextField>
            <Stack spacing={0.5}>
              <Typography color="text.secondary">Venues</Typography>
              <FormGroup row>
                {venueOptions.map((venue) => (
                  <FormControlLabel
                    key={venue.id}
                    control={
                      <Checkbox
                        checked={venueIds.includes(venue.id)}
                        onChange={(_, checked) =>
                          setVenueIds((prev) =>
                            checked ? Array.from(new Set([...prev, venue.id])) : prev.filter((id) => id !== venue.id)
                          )
                        }
                      />
                    }
                    label={venue.name}
                  />
                ))}
              </FormGroup>
            </Stack>
            <TextField
              label="Qualification percentage"
              value={qualificationPercentage}
              onChange={(e) => setQualificationPercentage(e.target.value)}
              placeholder="Optional"
              inputMode="numeric"
            />

            <Stack spacing={1}>
              <Typography sx={{ fontWeight: 900 }}>Sub-events</Typography>
              {subEvents.map((subEvent, index) => (
                <Box key={index} sx={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 1, p: 1.5 }}>
                  <Stack spacing={1}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField
                        label="Name"
                        value={subEvent.name}
                        onChange={(e) =>
                          setSubEvents((prev) => prev.map((item, i) => (i === index ? { ...item, name: e.target.value } : item)))
                        }
                        fullWidth
                      />
                      <Button
                        color="error"
                        variant="outlined"
                        disabled={subEvents.length === 1}
                        onClick={() => setSubEvents((prev) => prev.filter((_, i) => i !== index))}
                      >
                        Remove
                      </Button>
                    </Stack>
                    <Typography color="text.secondary">Vehicles</Typography>
                    <FormGroup row>
                      {vehicleOptions.map((vehicle) => (
                        <FormControlLabel
                          key={vehicle.id}
                          control={
                            <Checkbox
                              checked={subEvent.vehicleIds.includes(vehicle.id)}
                              onChange={(_, checked) => toggleSubEventOption(index, 'vehicleIds', vehicle.id, checked)}
                            />
                          }
                          label={vehicle.name}
                        />
                      ))}
                    </FormGroup>
                    <Typography color="text.secondary">Classes</Typography>
                    <FormGroup row>
                      {classOptions.map((driverClass) => (
                        <FormControlLabel
                          key={driverClass.id}
                          control={
                            <Checkbox
                              checked={subEvent.classIds.includes(driverClass.id)}
                              onChange={(_, checked) => toggleSubEventOption(index, 'classIds', driverClass.id, checked)}
                            />
                          }
                          label={driverClass.shortName ? `${driverClass.name} (${driverClass.shortName})` : driverClass.name}
                        />
                      ))}
                    </FormGroup>
                  </Stack>
                </Box>
              ))}
              <Button variant="outlined" onClick={() => setSubEvents((prev) => [...prev, { name: 'Class', vehicleIds: [], classIds: [] }])}>
                Add sub-event
              </Button>
            </Stack>

            <Button variant="contained" disabled={!canSubmit || submitting} onClick={createEvent}>
              {submitting ? 'Creating...' : 'Create VMS event'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Site-managed events
            </Typography>
            {events.length === 0 ? (
              <Typography color="text.secondary">No race events have been linked yet.</Typography>
            ) : (
              events.map((event) => (
                <Stack key={event.id} direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                  <Box>
                    <Typography sx={{ fontWeight: 800 }}>{event.name}</Typography>
                    <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                      {event.start_date} to {event.end_date} · {event.computedStatus ?? event.status}
                    </Typography>
                  </Box>
                  <Button component={Link} href={`/leaderboards/${event.slug}`} variant="outlined">
                    View
                  </Button>
                </Stack>
              ))
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
