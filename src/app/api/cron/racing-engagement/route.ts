import {NextResponse} from 'next/server';
import {runRacingShadow} from '@/lib/racing-engagement/server';
export const maxDuration=60;
export const dynamic='force-dynamic';
export async function GET(request:Request) {
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
 try{return NextResponse.json(await runRacingShadow(),{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Racing shadow sync failed; retry from retained checkpoint.'},{status:502});}
}
