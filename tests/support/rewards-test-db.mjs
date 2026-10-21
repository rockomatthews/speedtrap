// PostgreSQL-backed Supabase query adapter for isolated Stripe integration tests.
// No production URL, token, or network database connection is accepted.
import fs from 'node:fs';
const ident=s=>{if(!/^[a-z_][a-z0-9_]*$/.test(s))throw Error('Invalid SQL identifier');return '"'+s+'"';};
export async function rewardsTestDb(){
 const {PGlite}=await import(process.env.REWARDS_PGLITE_MODULE||'@electric-sql/pglite');const pg=new PGlite();
 const common=`profile_id uuid,customer_name text,customer_email text,customer_phone text,sms_consent_at timestamptz,duration_minutes integer,sim_count integer,party_size integer,starts_at timestamptz,ends_at timestamptz,buffer_until timestamptz,amount_cents integer,currency text default 'usd',status text default 'active',stripe_payment_intent_id text,membership_free_race_month text,membership_free_race_applied boolean default false,membership_discount_cents integer default 0,racing_discount_percent integer default 0,racing_discount_cents integer default 0,membership_credit_type text,membership_credit_month text,membership_credit_year integer`;
 await pg.exec(`create role anon;create role authenticated;create role service_role;
 create table profiles(id uuid primary key,display_name text);
 create table race_booking_holds(id uuid primary key default gen_random_uuid(),${common},expires_at timestamptz default now()+interval '15 minutes',payment_method_requested text default 'card');
 create table race_bookings(id uuid primary key default gen_random_uuid(),${common},source text,payment_method text,stripe_charge_id text,stripe_refund_id text,vms_customer_id integer,vms_booking_id integer,error text);
 create table private_event_deposits(id uuid primary key,stripe_payment_intent_id text,stripe_charge_id text);
 `);
 await pg.exec(fs.readFileSync(new URL('../../supabase/migrations/20261021174410_racing_rewards_wallet.sql',import.meta.url),'utf8'));
 const query=async(sql,args=[])=>JSON.parse(JSON.stringify((await pg.query(sql,args)).rows));
 const db={
  async rpc(name,args={}){try{const keys=Object.keys(args);const rows=await query(`select ${ident(name)}(${keys.map((k,i)=>ident(k)+' => $'+(i+1)).join(',')}) as result`,Object.values(args));return {data:rows[0].result,error:null};}catch(e){return {data:null,error:{message:e.message,code:e.code}};}},
  from(table){let op='select',payload,filters=[],params=[],ordering='',max='',conflict='';
   const where=()=>filters.length?' where '+filters.join(' and '):'';
   const add=(k,operator,v)=>{params.push(v);filters.push(`${ident(k)} ${operator} $${params.length}`);return chain;};
   const chain={select(){return chain;},eq(k,v){return add(k,'=',v);},gt(k,v){return add(k,'>',v);},lt(k,v){return add(k,'<',v);},is(k,v){if(v!==null)throw Error('Only null supported');filters.push(ident(k)+' is null');return chain;},in(k,values){params.push(values);filters.push(`${ident(k)} = any($${params.length})`);return chain;},order(k,o={}){ordering=` order by ${ident(k)} ${o.ascending===false?'desc':'asc'}`;return chain;},limit(n){max=' limit '+Number(n);return chain;},
    insert(v){op='insert';payload=v;return chain;},upsert(v,o={}){op='insert';payload=v;conflict=' on conflict ('+ident(o.onConflict||'id')+') do nothing';return chain;},update(v){op='update';payload=v;return chain;},
    async run(single=false){try{let sql,args=params;
     if(op==='select')sql=`select * from ${ident(table)}${where()}${ordering}${max}`;
     if(op==='insert'){const keys=Object.keys(payload).filter(k=>payload[k]!==undefined);args=keys.map(k=>payload[k]);sql=`insert into ${ident(table)} (${keys.map(ident)}) values (${keys.map((_,i)=>'$'+(i+1))})${conflict} returning *`;}
     if(op==='update'){const keys=Object.keys(payload).filter(k=>payload[k]!==undefined);args=[...params,...keys.map(k=>payload[k])];sql=`update ${ident(table)} set ${keys.map((k,i)=>ident(k)+'=$'+(params.length+i+1))}${where()} returning *`;}
     const rows=await query(sql,args);return {data:single?rows[0]??null:rows,error:null};
    }catch(e){return {data:null,error:{message:e.message,code:e.code}};}},single(){return chain.run(true);},maybeSingle(){return chain.run(true);},then(a,b){return chain.run().then(a,b);}
   };return chain;
  }
 };
 return {db,pg,query};
}
