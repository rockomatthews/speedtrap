'use client';

import { useState } from 'react';
import { isWinterSeries, WINTER_DEPOSIT_CENTS } from '@/lib/leagues/winter-series';
import Link from 'next/link';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

type Props = {
  leagueSlug: string;
  signedIn: boolean;
  loginHref: string;
  alreadyRegistered: boolean;
  registrationStatus: string | null;
  capacity: number;
  registeredCount: number;
  weeklyFeeCents: number;
  fullSeasonFeeCents: number;
  seasonWeeks: number;
  defaultDriverName: string;
  success: boolean;
  registrationClosed?: boolean;
  cancelled: boolean;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}

export function LeagueRegistrationCard(props: Props) {
  const winter = isWinterSeries(props.leagueSlug);
  const [driverName, setDriverName] = useState(props.defaultDriverName);
  const [paymentOption, setPaymentOption] = useState<'installments' | 'full_season'>(winter ? 'installments' : 'full_season');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = Math.max(0, props.capacity - props.registeredCount);
  const fullSeasonSavings = Math.max(0, props.weeklyFeeCents * props.seasonWeeks - props.fullSeasonFeeCents);

  async function register() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/leagues/${props.leagueSlug}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverName, paymentOption })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Could not start league registration.');
      if (json.url) window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start league registration.');
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        p: { xs: 2.5, md: 3.5 },
        border: '1px solid rgba(255,210,0,0.5)',
        bgcolor: '#111',
        background:
          'linear-gradient(135deg, rgba(255,210,0,0.1), transparent 42%), linear-gradient(115deg, rgba(255,22,31,0.14), transparent 62%), #111'
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'flex-start' }}>
        <Box>
          <Chip label={winter ? "Winter Series Registration" : "League Night Registration"} sx={{ bgcolor: '#FFD200', color: '#000', fontWeight: 1000, mb: 1.5 }} />
          <Typography variant="h3" sx={{ fontWeight: 1000, fontSize: { xs: 34, md: 48 }, lineHeight: 0.98 }}>
            {winter ? "Secure your Winter Series seat." : "Join the Tuesday grid."}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 760 }}>
            {winter ? "Teams of four. Race on your own schedule Monday–Thursday; your best valid lap counts for your team. Solo signups welcome. This checkout reserves one driver seat." : "Eight teams of four drivers. Every driver races one 30-minute heat each Tuesday night. Your checkout registers your own driver seat only; teammates register separately."}
          </Typography>
        </Box>
        <Box sx={{ minWidth: { md: 230 }, p: 2, border: '1px solid rgba(255,255,255,0.14)', bgcolor: 'rgba(0,0,0,0.45)' }}>
          <Typography color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase', fontSize: 12 }}>
            Roster spots
          </Typography>
          <Typography sx={{ fontWeight: 1000, fontSize: 28 }}>
            {props.registeredCount}/{props.capacity}
          </Typography>
          <Typography color="text.secondary">{remaining ? `${remaining} open` : 'Season is full'}</Typography>
        </Box>
      </Stack>

      <Stack spacing={2.25} sx={{ mt: 3 }}>
        {props.success ? <Alert severity="success">Payment received. Your league spot is being added to the roster.</Alert> : null}
        {props.cancelled ? <Alert severity="warning">League checkout was cancelled. Your spot is not reserved yet.</Alert> : null}
        {props.alreadyRegistered ? (
          <Alert severity="success">
            Your driver seat is registered{props.registrationStatus ? ` (${props.registrationStatus})` : ''}. Staff can place you on a
            team and make you captain so you can manage the team name.
          </Alert>
        ) : null}
        {error ? <Alert severity="error">{error}</Alert> : null}

        {winter ? <Alert severity="info">$40 per week × 8 weeks = $320 per driver. The $50 deposit is part of that total, leaving $270 in dues. It covers week one and $10 of week two. Applicable sales tax is added at checkout. Full-season payment includes your seat; no extra deposit.</Alert> : null}
        {props.registrationClosed ? <Alert severity="info">Signups closed November 22.</Alert> : !props.signedIn ? (
          <Button component={Link} href={props.loginHref} variant="contained" size="large" sx={{ alignSelf: 'flex-start' }}>
            Sign in to register
          </Button>
        ) : props.alreadyRegistered ? null : (
          <>
            <TextField
              label="Driver name"
              value={driverName}
              onChange={(event) => setDriverName(event.target.value)}
              placeholder="Rocket_Rob"
              fullWidth
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Button
                  fullWidth
                  variant={paymentOption === 'installments' ? 'contained' : 'outlined'}
                  color={paymentOption === 'installments' ? 'primary' : 'inherit'}
                  onClick={() => setPaymentOption('installments')}
                  sx={{ justifyContent: 'space-between', p: 2.25, minHeight: 112 }}
                >
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography sx={{ fontWeight: 1000 }}>{winter ? "Reserve with a deposit" : "Pay weekly"}</Typography>
                    <Typography color="text.secondary">{winter ? "$50 today, credited toward season dues" : "Your seat today; weekly dues tracked after that"}</Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 1000 }}>{winter ? formatMoney(WINTER_DEPOSIT_CENTS) : `${formatMoney(props.weeklyFeeCents)}/wk`}</Typography>
                </Button>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Button
                  fullWidth
                  variant={paymentOption === 'full_season' ? 'contained' : 'outlined'}
                  color={paymentOption === 'full_season' ? 'primary' : 'inherit'}
                  onClick={() => setPaymentOption('full_season')}
                  sx={{ justifyContent: 'space-between', p: 2.25, minHeight: 112 }}
                >
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography sx={{ fontWeight: 1000 }}>Pay season</Typography>
                    <Typography color="text.secondary">
                      {fullSeasonSavings ? `One driver seat · save ${formatMoney(fullSeasonSavings)}` : 'One driver seat · one payment'}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 1000 }}>{formatMoney(props.fullSeasonFeeCents)}</Typography>
                </Button>
              </Grid>
            </Grid>
            <Button
              variant="contained"
              size="large"
              disabled={loading || !driverName.trim() || remaining <= 0}
              onClick={register}
              sx={{ alignSelf: 'flex-start' }}
            >
              {loading ? 'Opening checkout...' : remaining <= 0 ? 'League full' : 'Register for league'}
            </Button>
          </>
        )}
      </Stack>
    </Box>
  );
}
