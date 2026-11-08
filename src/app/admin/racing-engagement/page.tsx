import {AppShell} from '@/components/AppShell';
import {getCurrentUserAndAdminRole} from '@/lib/supabase/admin-role';
import {Alert} from '@mui/material';
import {ShadowReview} from './ShadowReview';
export default async function Page(){const {role}=await getCurrentUserAndAdminRole();return <AppShell>{role==='admin'?<ShadowReview/>:<Alert severity="warning">Sign in as an admin to review racing alerts.</Alert>}</AppShell>;}
