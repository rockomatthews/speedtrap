import {NextResponse} from 'next/server';
import {releaseExpiredWalletHolds,rewardsRpc} from '@/lib/rewards/server';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
export const maxDuration=60;
export async function GET(request:Request) {
 if(!process.env.CRON_SECRET || request.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({error:'Unauthorized'},{status:401});
 // Independent jobs: a Stripe reconciliation outage must not prevent session rewards.
 const [awards,holds]=await Promise.allSettled([
  rewardsRpc(createSupabaseAdminClient(),'rewards_complete_due',{}),
  releaseExpiredWalletHolds()
 ]);
 if(awards.status==='rejected') console.error('Automatic session rewards failed',awards.reason);
 if(holds.status==='rejected') console.error('Wallet hold reconciliation failed',holds.reason);
 if(awards.status==='rejected'||holds.status==='rejected') return NextResponse.json({error:'Rewards maintenance incomplete; failed work will retry.',completed:awards.status==='fulfilled'?awards.value:null},{status:500});
 return NextResponse.json({ok:true,completed:awards.value});
}
