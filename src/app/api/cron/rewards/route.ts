import {NextResponse} from 'next/server';
import {releaseExpiredWalletHolds} from '@/lib/rewards/server';
export const maxDuration=60;
export async function GET(request:Request) {
 if(!process.env.CRON_SECRET || request.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({error:'Unauthorized'},{status:401});
 try {await releaseExpiredWalletHolds();return NextResponse.json({ok:true});}
 catch(e){console.error('Wallet hold reconciliation failed',e);return NextResponse.json({error:'Wallet reconciliation failed; balances retained.'},{status:500});}
}
