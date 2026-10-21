'use client';
import {useEffect,useState,useRef} from 'react';
import {Alert,Box,Button,Card,CardContent,LinearProgress,Stack,Typography,TextField} from '@mui/material';
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
export function RewardsWallet(){
 const redemptionKey=useRef<string|null>(null),purchaseKeys=useRef<Record<number,string>>({});
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[code,setCode]=useState('');
 async function load(){const r=await fetch('/api/rewards',{cache:'no-store'});const j=await r.json();if(!r.ok) throw new Error(j.error);setData(j);}
 async function action(body:any){setBusy(true);setError('');try{const r=await fetch('/api/rewards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok) throw new Error(j.error);setData(j);if(body.action==='redeem')redemptionKey.current=null;}catch(e){setError(String(e instanceof Error?e.message:e));}finally{setBusy(false);}}
 useEffect(()=>{const sessionId=new URLSearchParams(window.location.search).get('session_id');if(sessionId) void action({action:'confirm_topup',sessionId});else void load().catch(e=>setError(e.message));},[]);
 async function buy(amountCents:number){setBusy(true);setError('');try{const r=await fetch('/api/rewards/topup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amountCents,key:purchaseKeys.current[amountCents]??(purchaseKeys.current[amountCents]=crypto.randomUUID())})});const j=await r.json();if(!r.ok) throw new Error(j.error);window.location.assign(j.url);}catch(e){setError(String(e instanceof Error?e.message:e));setBusy(false);}}
 const points=Number(data?.wallet?.points_units??0)/100,threshold=data?.settings?.redemption_points??100;
 return <Stack spacing={3}>
 <Typography variant="h3" fontWeight={900}>My Rewards</Typography>
 <Typography>Earn points on completed, paid racing. Exchange points for racing rewards and use your balance at website checkout.</Typography>
 {error&&<Alert severity="error">{error} <Button onClick={()=>load().catch(e=>setError(e.message))}>Retry</Button></Alert>}
 {!data&&!error&&<LinearProgress />}
 {data&&<>
 {!data.settings.enabled&&<Alert severity="info">New point earning is currently paused. Existing balances remain available.</Alert>}
 <Stack direction={{xs:'column',md:'row'}} spacing={2}>
 {[['Purchased racing credits',money(data.wallet.purchased_cents)],['Available racing rewards',money(data.wallet.promo_cents)],['Rewards points',points.toFixed(2)]].map(([label,value])=><Card key={label} variant="outlined" sx={{flex:1}}><CardContent><Typography>{label}</Typography><Typography variant="h4" fontWeight={900}>{value}</Typography></CardContent></Card>)}
 </Stack>
 <Box><Typography>{points>=threshold?'You have enough points to unlock a reward.':`Earn ${Math.max(0,threshold-points).toFixed(2)} more points for ${money(data.settings.reward_cents)} in racing rewards.`}</Typography><LinearProgress variant="determinate" value={Math.min(100,Math.max(0,points/threshold*100))} sx={{my:2}} /><Button variant="contained" disabled={busy||points<threshold} onClick={()=>action({action:'redeem',key:redemptionKey.current??(redemptionKey.current=crypto.randomUUID())})}>Exchange {threshold} points for {money(data.settings.reward_cents)}</Button></Box>
 <Typography color="text.secondary">Earn {data.settings.points_per_dollar} point(s) per eligible $1 after discounts and before tax. Points are awarded after staff confirms attendance. Purchased credits earn points when used for eligible racing, not when purchased. Rewards cover up to 25% of racing, cannot combine with discount-mode pricing, and do not earn points. Membership fees, included sessions, league dues, deposits, food and merch are excluded. Points do not expire during the pilot. No cash redemption or transfers.</Typography>
 <Box><Typography variant="h5" fontWeight={800}>Add racing credits</Typography><Typography sx={{mb:2}}>1 credit = $1. Use prepaid credits toward racing and its checkout tax. No expiration. Refund requests are handled by staff.</Typography><Stack direction="row" spacing={1} flexWrap="wrap">{[2500,5000,10000,20000].map(n=><Button key={n} variant="outlined" disabled={busy||!data.settings.wallet_sales_enabled} onClick={()=>buy(n)}>{money(n)}</Button>)}</Stack>{!data.settings.wallet_sales_enabled&&<Typography color="text.secondary">Credit purchases are not open yet.</Typography>}</Box>
 {data.settings.referrals_enabled&&<Box><Typography variant="h5">Bring a friend</Typography><Typography>Share your code: <b>{data.wallet.referral_code}</b></Typography><Typography>Earn 100 points after a new racer completes their first eligible $30+ session. Maximum five rewards per month. Your friend must enter the code before their first booking.</Typography>{!data.wallet.referred_by&&<Stack direction={{xs:'column',sm:'row'}} spacing={1} sx={{mt:2}}><TextField label="Friend’s referral code" value={code} onChange={e=>setCode(e.target.value.trim())}/><Button disabled={busy||!code} onClick={()=>action({action:'refer',code})}>Apply referral</Button></Stack>}</Box>}
 {!!data.pending?.length&&<Box><Typography variant="h5">Pending session points</Typography>{data.pending.map((b:any)=><Typography key={b.id}>{new Date(b.starts_at).toLocaleString('en-US',{timeZone:'America/New_York'})} ET · up to {(b.rewards_subtotal_cents*b.rewards_rate/100).toFixed(2)} points after attendance</Typography>)}</Box>}
 <Box><Typography variant="h5" sx={{mb:1}}>Balance history</Typography>{data.ledger.length===0?<Typography>No transactions yet.</Typography>:data.ledger.map((row:any)=><Stack key={row.id} direction="row" justifyContent="space-between" sx={{py:1,borderBottom:'1px solid #333',gap:2}}><Box><Typography>{row.reason}</Typography><Typography variant="caption">{new Date(row.created_at).toLocaleString()} · {row.bucket}</Typography></Box><Typography>{row.amount>0?'+':''}{row.bucket==='points'?`${(row.amount/100).toFixed(2)} points`:money(row.amount)}</Typography></Stack>)}</Box>
 </>}
 </Stack>;
}
