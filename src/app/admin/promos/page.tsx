import {AppShell} from '@/components/AppShell';
import {getCurrentUserAndAdminRole} from '@/lib/supabase/admin-role';
import {Alert} from '@mui/material';
import {PromoAdmin} from './PromoAdmin';
export default async function Page(){const {role}=await getCurrentUserAndAdminRole();return <AppShell>{role==='admin'?<PromoAdmin/>:<Alert severity="warning">Sign in as an admin to manage promo codes.</Alert>}</AppShell>;}
