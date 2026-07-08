'use client';

import { useEffect, useMemo, useState } from 'react';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';

import { MembershipCheckoutButton } from '@/components/MembershipCheckoutButton';
import { MEMBERSHIP_DISCOUNT_PERCENT, type MembershipStatus } from '@/lib/membership';

type SuccessProfile = {
  membership_status: MembershipStatus;
  membership_current_period_end: string | null;
  membership_free_race_redeemed_at: string | null;
  birthday: string | null;
  membership_monthly_15_race_month: string | null;
  membership_monthly_15_race_redeemed_at: string | null;
  membership_birthday_30_race_redeemed_at: string | null;
} | null;

function isActive(profile: SuccessProfile) {
  return profile?.membership_status === 'active-start' || profile?.membership_status === 'active';
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Pending Stripe sync';
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export function MembershipSuccessPanel({ initialProfile }: { initialProfile: SuccessProfile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [checking, setChecking] = useState(!isActive(initialProfile));
  const [error, setError] = useState('');

  useEffect(() => {
    if (isActive(initialProfile)) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const interval = window.setInterval(async () => {
      attempts += 1;
      try {
        const response = await fetch('/api/profile', { cache: 'no-store' });
        const json = (await response.json().catch(() => null)) as { profile?: SuccessProfile; error?: string } | null;
        if (!response.ok) throw new Error(json?.error ?? 'Could not refresh membership status.');
        if (cancelled) return;
        setProfile(json?.profile ?? null);
        if (isActive(json?.profile ?? null) || attempts >= 10) {
          setChecking(false);
          window.clearInterval(interval);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not refresh membership status.');
          setChecking(false);
        }
        window.clearInterval(interval);
      }
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [initialProfile]);

  const active = isActive(profile);
  const monthlyCreditLabel = useMemo(() => {
    if (!active) return 'Pending';
    return profile?.membership_monthly_15_race_redeemed_at || profile?.membership_free_race_redeemed_at ? 'Used' : 'Available';
  }, [active, profile]);
  const birthdayCreditLabel = useMemo(() => {
    if (!active) return 'Pending';
    if (!profile?.birthday) return 'Add birthday';
    return profile.membership_birthday_30_race_redeemed_at ? 'Used this year' : 'Ready in birthday month';
  }, [active, profile]);

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: active ? 'rgba(255,210,0,0.75)' : 'rgba(255,255,255,0.12)',
        background:
          'linear-gradient(135deg, rgba(255,210,0,0.16), rgba(255,22,31,0.08) 42%, rgba(255,255,255,0.03))'
      }}
    >
      <CardContent>
        <Stack spacing={3}>
          <Stack spacing={1.25} alignItems="flex-start">
            <Chip
              icon={active ? <CheckCircleIcon /> : <CircularProgress color="inherit" size={16} />}
              label={active ? 'Membership Activated' : 'Activating Membership'}
              color={active ? 'primary' : 'default'}
              sx={{ fontWeight: 950 }}
            />
            <Typography variant="h3" sx={{ fontWeight: 950, lineHeight: 0.95 }}>
              {active ? 'You are now a Speed Trap member.' : 'We are syncing your member pass.'}
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 760 }}>
              {active
                ? 'Your member pass is live in the Driver Portal. Show it to staff for perks and use your monthly race credit online when booking is turned back on.'
                : 'Stripe approved the checkout. The membership badge usually appears here within a few seconds.'}
            </Typography>
          </Stack>

          {error ? <Alert severity="warning">{error}</Alert> : null}
          {!active && !checking ? (
            <Alert severity="info">If the badge still says pending, refresh this page in a moment. Stripe webhooks can lag briefly.</Alert>
          ) : null}

          <Grid container spacing={1.25}>
            {[
              ['Discount', `${MEMBERSHIP_DISCOUNT_PERCENT}% off everything`],
              ['Monthly 15', monthlyCreditLabel],
              ['Birthday 30', birthdayCreditLabel],
              ['Renewal', formatDate(profile?.membership_current_period_end)],
              ['Member events', 'Invited']
            ].map(([label, value]) => (
              <Grid key={label} size={{ xs: 12, sm: 6, md: 3 }}>
                <Box sx={{ p: 1.5, border: '1px solid rgba(255,255,255,0.12)', bgcolor: 'rgba(0,0,0,0.25)' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>
                    {label}
                  </Typography>
                  <Typography sx={{ fontWeight: 950 }}>{value}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button component={Link} href="/dashboard" variant="contained" startIcon={<WorkspacePremiumIcon />}>
              View My Member Pass
            </Button>
            <Button component={Link} href="/pricing" variant="outlined">
              Back to Pricing
            </Button>
            {active ? <MembershipCheckoutButton manage>Manage membership</MembershipCheckoutButton> : null}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
