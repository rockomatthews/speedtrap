import Link from 'next/link';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';
import { MEMBERSHIP_DISCOUNT_PERCENT, membershipState, type MembershipStatus } from '@/lib/membership';
import { getCurrentUserAndAdminRole } from '@/lib/supabase/admin-role';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type MemberProfile = {
  id: string;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  membership_status: MembershipStatus | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  membership_current_period_start: string | null;
  membership_current_period_end: string | null;
  membership_free_race_month: string | null;
  membership_free_race_redeemed_at: string | null;
  updated_at: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function shortId(value: string | null | undefined) {
  if (!value) return '—';
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

export default async function AdminMembersPage() {
  const { role, user } = await getCurrentUserAndAdminRole();

  let members: Array<MemberProfile & { email: string | null }> = [];
  let loadError = '';

  if (role === 'admin') {
    try {
      const supabase = createSupabaseAdminClient();
      const [{ data, error }, authUsers] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'id,display_name,phone,avatar_url,membership_status,stripe_customer_id,stripe_subscription_id,membership_current_period_start,membership_current_period_end,membership_free_race_month,membership_free_race_redeemed_at,updated_at'
          )
          .order('updated_at', { ascending: false })
          .limit(250),
        supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
      ]);
      if (error) throw new Error(error.message);
      if (authUsers.error) throw new Error(authUsers.error.message);

      const emails = new Map(authUsers.data.users.map((authUser) => [authUser.id, authUser.email ?? null]));
      members = (data ?? []).map((profile) => ({ ...profile, email: emails.get(profile.id) ?? null }));
    } catch (error) {
      loadError = error instanceof Error ? error.message : 'Failed to load members.';
    }
  }

  const activeMembers = members.filter((member) => membershipState(member).active);
  const creditAvailable = activeMembers.filter((member) => membershipState(member).freeRaceAvailable);

  return (
    <AppShell>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
          <Stack spacing={0.5}>
            <Typography variant="h4" sx={{ fontWeight: 950 }}>
              Members
            </Typography>
            <Typography color="text.secondary">See who is active, who has a free race, and what staff should honor.</Typography>
          </Stack>
          <Button component={Link} href="/admin" variant="outlined">
            Back to Admin
          </Button>
        </Stack>

        {role !== 'admin' ? (
          <Alert severity="warning">You are signed in as {user?.email ?? 'unknown'}, but your role is not admin.</Alert>
        ) : (
          <Stack spacing={2}>
            {loadError ? <Alert severity="error">{loadError}</Alert> : null}

            <Grid container spacing={1.25}>
              {[
                ['Active members', String(activeMembers.length)],
                ['Monthly credits available', String(creditAvailable.length)],
                ['Member discount', `${MEMBERSHIP_DISCOUNT_PERCENT}%`],
                ['Profiles shown', String(members.length)]
              ].map(([label, value]) => (
                <Grid key={label} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, textTransform: 'uppercase' }}>
                        {label}
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 950 }}>
                        {value}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Card variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.12)' }}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="h6" sx={{ fontWeight: 950 }}>
                    Member Directory
                  </Typography>
                  <TableContainer component={Box} sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Customer</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Free race</TableCell>
                          <TableCell>Period</TableCell>
                          <TableCell>Stripe</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {members.map((member) => {
                          const state = membershipState(member);
                          return (
                            <TableRow key={member.id}>
                              <TableCell>
                                <Stack spacing={0.25}>
                                  <Typography sx={{ fontWeight: 900 }}>{member.display_name || member.email || 'Unnamed driver'}</Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {member.email ?? 'No email found'}
                                  </Typography>
                                </Stack>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={state.active ? 'Active Apex Pass' : 'Inactive'}
                                  color={state.active ? 'primary' : 'default'}
                                  sx={{ fontWeight: 900 }}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography sx={{ fontWeight: 800 }}>{state.freeRaceAvailable ? 'Available' : state.active ? 'Used' : '—'}</Typography>
                                {member.membership_free_race_redeemed_at ? (
                                  <Typography variant="body2" color="text.secondary">
                                    Used {formatDate(member.membership_free_race_redeemed_at)}
                                  </Typography>
                                ) : null}
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {formatDate(member.membership_current_period_start)} - {formatDate(member.membership_current_period_end)}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Stack spacing={0.25}>
                                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                    {shortId(member.stripe_customer_id)}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                    {shortId(member.stripe_subscription_id)}
                                  </Typography>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {!members.length ? (
                          <TableRow>
                            <TableCell colSpan={5}>
                              <Typography color="text.secondary">No profiles found yet.</Typography>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        )}
      </Stack>
    </AppShell>
  );
}
