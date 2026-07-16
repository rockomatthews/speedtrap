import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { MembershipCheckoutButton } from '@/components/MembershipCheckoutButton';
import { MEMBERSHIP_DISCOUNT_PERCENT, membershipState } from '@/lib/membership';
import type { Profile } from '@/lib/supabase/profile';

function formatDate(value: string | null | undefined) {
  if (!value) return 'Pending Stripe sync';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export function MemberPassCard({ profile, email }: { profile: Profile | null; email: string | null | undefined }) {
  const state = membershipState(profile);
  const displayName = profile?.display_name || email || 'Speed Trap Driver';
  const initials = displayName
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  if (!state.active) {
    return (
      <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
              <Stack spacing={0.75}>
                <Chip label="Apex Pass" color="primary" sx={{ alignSelf: 'flex-start', fontWeight: 900 }} />
                <Typography variant="h5" sx={{ fontWeight: 950 }}>
                  Not a member yet
                </Typography>
                <Typography color="text.secondary">
                  Join for $45/month to unlock 10% off food and merch, priority booking, a monthly 15-minute session,
                  birthday-month 30-minute session, and member events.
                </Typography>
              </Stack>
              <MembershipCheckoutButton collectBirthday existingBirthday={profile?.birthday}>
                Join for $45/month
              </MembershipCheckoutButton>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      variant="outlined"
      sx={{
        overflow: 'hidden',
        borderColor: 'rgba(255,210,0,0.65)',
        background:
          'linear-gradient(135deg, rgba(255,210,0,0.12), rgba(255,22,31,0.08) 42%, rgba(255,255,255,0.03))'
      }}
    >
      <CardContent>
        <Stack spacing={2.25}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
              <Avatar
                src={profile?.avatar_url ?? undefined}
                sx={{
                  width: 76,
                  height: 76,
                  bgcolor: '#FFD200',
                  color: '#000',
                  fontWeight: 950,
                  border: '2px solid rgba(255,255,255,0.35)'
                }}
              >
                {profile?.avatar_url ? null : initials || <WorkspacePremiumIcon />}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" sx={{ minWidth: 0 }}>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 950,
                      minWidth: 0,
                      maxWidth: '100%',
                      overflowWrap: 'anywhere',
                      fontSize: { xs: 'clamp(1.55rem, 8vw, 2rem)', sm: '1.8rem' },
                      lineHeight: 1
                    }}
                  >
                    {displayName}
                  </Typography>
                  <Chip label="Active Apex Pass" color="primary" sx={{ fontWeight: 950 }} />
                </Stack>
                <Typography color="text.secondary">Show this member pass to staff for Speed Trap perks.</Typography>
              </Box>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <MembershipCheckoutButton manage>Manage membership</MembershipCheckoutButton>
            </Stack>
          </Stack>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />

          <Grid container spacing={1.25}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box sx={{ p: 1.5, border: '1px solid rgba(255,255,255,0.12)', bgcolor: 'rgba(0,0,0,0.25)' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>
                  Staff badge
                </Typography>
                <Typography sx={{ fontWeight: 950, color: 'primary.main' }}>MEMBER</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box sx={{ p: 1.5, border: '1px solid rgba(255,255,255,0.12)', bgcolor: 'rgba(0,0,0,0.25)' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>
                  Discount
                </Typography>
                <Typography sx={{ fontWeight: 950 }}>{MEMBERSHIP_DISCOUNT_PERCENT}% off everything</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box sx={{ p: 1.5, border: '1px solid rgba(255,255,255,0.12)', bgcolor: 'rgba(0,0,0,0.25)' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>
                  Monthly 15
                </Typography>
                <Typography sx={{ fontWeight: 950 }}>{state.monthly15Available ? 'Available' : 'Used'}</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box sx={{ p: 1.5, border: '1px solid rgba(255,255,255,0.12)', bgcolor: 'rgba(0,0,0,0.25)' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>
                  Birthday 30
                </Typography>
                <Typography sx={{ fontWeight: 950 }}>
                  {!state.birthdayOnFile ? 'Add birthday' : state.birthdayMonthActive ? (state.birthday30Available ? 'Available' : 'Used') : 'Birthday month'}
                </Typography>
              </Box>
            </Grid>
          </Grid>
          <Typography color="text.secondary" sx={{ fontSize: 13 }}>
            Current period ends {formatDate(profile?.membership_current_period_end)}.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
