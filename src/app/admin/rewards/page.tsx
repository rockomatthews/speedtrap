import {AppShell} from '@/components/AppShell';
import {getCurrentUserAndAdminRole} from '@/lib/supabase/admin-role';
import {Alert} from '@mui/material';
import {RewardsAdmin} from './RewardsAdmin';
export default async function Page(){const {role}=await getCurrentUserAndAdminRole();return <AppShell>{role==='admin'?<RewardsAdmin/>:<Alert severity="warning">Sign in as an admin to manage rewards.</Alert>}</AppShell>;}
