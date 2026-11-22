"use client";

import { useEffect, useState } from "react";

const states={ready:"Ready",offline:"Offline",needs_config:"Preset needed",launching:"Launch requested",
  launch_unconfirmed:"Check rig",awaiting_drive:"Waiting for Drive",racing:"On track",time_up:"Time is up"};
const demoRigs=()=>[1,2,3,4].map(id=>({id:String(id),name:"Sim "+id,status:"ready",online:true,session:null}));

export default function Desk() {
  const [mode,setMode]=useState("demo");
  const [key,setKey]=useState("");
  const [rigs,setRigs]=useState(demoRigs);
  const [drivers,setDrivers]=useState({});
  const [selected,setSelected]=useState({});
  const [duration,setDuration]=useState(15);
  const [clock,setClock]=useState(0);
  const [code,setCode]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    const timer=setInterval(()=>setClock(Date.now()),1000);
    return ()=>clearInterval(timer);
  },[]);
  async function api(path, data, token=key) {
    const response=await fetch("/api/desk/v1/"+path,{
      method:data===undefined?"GET":"POST",cache:"no-store",
      headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
      ...(data===undefined?{}:{body:JSON.stringify(data)})
    });
    const result=await response.json();
    if (!response.ok) throw Error(result.error ?? "Desk request failed.");
    return result;
  }
  useEffect(()=>{
    if (mode!=="cloud") return;
    let active=true;
    const timer=setInterval(async ()=>{
      try { const result=await api("state");if(active)setRigs(result.rigs); }
      catch (error) { if(active)setNotice(error.message); }
    },4500);
    return ()=>{active=false;clearInterval(timer);};
  },[mode,key]);
  async function work(action) {
    setBusy(true);setNotice("");
    try { await action(); }
    catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }
  function practice() {
    setKey("");setCode("");setDrivers({});setSelected({});setRigs(demoRigs());setMode("demo");
  }
  async function signIn(event) {
    event.preventDefault();
    const token=new FormData(event.currentTarget).get("key").trim();
    await work(async ()=>{
      const result=await api("state",undefined,token);
      setKey(token);setCode("");setRigs(result.rigs);setDrivers({});setSelected({});setMode("cloud");
    });
  }
  async function start() {
    const seats=rigs.filter(rig=>selected[rig.id] && rig.status==="ready")
      .map(rig=>({rigId:rig.id,driver:(drivers[rig.id]??"").trim()}));
    if (!seats.length || seats.some(seat=>!seat.driver)) throw Error("Select ready rigs and enter a driver for each.");
    if (mode==="cloud") setRigs((await api("start",{seats,minutes:duration})).rigs);
    else setRigs(items=>items.map(rig=>{
      const seat=seats.find(item=>item.rigId===rig.id);
      return seat ? {...rig,status:"awaiting_drive",session:{driver:seat.driver,minutes:duration,endsAt:null}} : rig;
    }));
    setSelected({});
  }
  async function change(rig,action) {
    const input={action};
    if (action==="rotate") {
      const driver=window.prompt("Name of next driver");
      if (!driver?.trim()) return;
      input.driver=driver.trim();
    }
    if (action==="extend") input.minutes=5;
    if (action==="finish" || action==="revoke") {
      if (!window.confirm(action==="finish"?"Confirm the driver has exited the track.":"Unpair this rig?")) return;
      input.confirmed=true;
    }
    if (mode==="cloud") {setRigs((await api("session/"+rig.id,input)).rigs);return;}
    setRigs(items=>items.map(item=>{
      if (item.id!==rig.id) return item;
      if (action==="finish") return {...item,status:"ready",session:null};
      const session={...item.session};
      if (action==="confirm") return {...item,status:"racing",session:{...session,endsAt:Date.now()+session.minutes*60_000}};
      if (action==="rotate") session.driver=input.driver;
      if (action==="extend") {session.endsAt+=300_000;session.minutes+=5;}
      return {...item,session};
    }));
  }
  return <main>
    <section className="hero"><div><h1>rFactor 2 desk</h1><p>Single-player practice on up to four rigs.</p></div><a href="/">Competitions</a></section>
    <section className="panel">
      <h2>{mode==="demo"?"Browser demo":"Connected venue"}</h2>
      <p>{mode==="demo"?"These four rigs are simulated. Try assigning seats and confirm Drive to start the clock.":"Commands go to paired rig agents. Confirm Drive only after verifying the car and track."}</p>
      {mode==="demo" ? <details><summary>Connect real rigs</summary><form onSubmit={signIn}>
        <label>Venue desk key<input name="key" type="password" required autoComplete="off"/></label><button disabled={busy}>Connect venue</button>
      </form></details> : <div className="split">
        <button disabled={busy} onClick={()=>work(async()=>setCode((await api("pair-code",{})).code))}>Pair a rig</button>
        <button disabled={busy} onClick={practice}>Return to browser demo</button>
        {code && <p>Pairing code valid for five minutes <code className="secret">{code}</code></p>}
      </div>}
    </section>
    <p className="notice" role="status">{notice}</p>
    <section className="panel">
      <div className="split"><label>Minutes<input type="number" min="1" max="240" value={duration} onChange={e=>setDuration(Number(e.target.value))}/></label>
      <button disabled={busy || duration<1 || duration>240} onClick={()=>work(start)}>Start selected rigs</button></div>
      <div className="cards">{rigs.map(rig=>{
        const session=rig.session;
        const seconds=session?.endsAt && clock ? Math.max(0,Math.ceil((session.endsAt-clock)/1000)):null;
        const state=seconds===0 && rig.status==="racing"?"time_up":rig.status;
        return <section className="panel" key={rig.id}>
          <h3>{rig.name}</h3><p><b>{states[state]??state}</b>{!rig.online && state!=="offline"?" · Rig disconnected":""}</p>
          {session ? <>
            <p>{session.driver}</p>
            <p>{seconds===null?`${session.minutes} minutes reserved`:`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")} remaining`}</p>
            {session.detail && <p>{session.detail}</p>}
            <div className="split">
              {["awaiting_drive","launch_unconfirmed"].includes(state) && <button disabled={busy || !rig.online} onClick={()=>work(()=>change(rig,"confirm"))}>Driver on track</button>}
              {state==="racing" && <><button disabled={busy} onClick={()=>work(()=>change(rig,"rotate"))}>Rotate driver</button>
                <button disabled={busy || session.minutes>235} onClick={()=>work(()=>change(rig,"extend"))}>Add 5 min</button></>}
              {state!=="launching" && <button disabled={busy} onClick={()=>work(()=>change(rig,"finish"))}>Finish seat</button>}
            </div>
          </> : <>
            <label className="checkbox"><input type="checkbox" disabled={state!=="ready"} checked={!!selected[rig.id]} onChange={e=>setSelected({...selected,[rig.id]:e.target.checked})}/>Select rig</label>
            <label>Driver<input maxLength={80} disabled={state!=="ready"} value={drivers[rig.id]??""} onChange={e=>setDrivers({...drivers,[rig.id]:e.target.value})}/></label>
            {mode==="cloud" && <button disabled={busy} onClick={()=>work(()=>change(rig,"revoke"))}>Unpair</button>}
          </>}
        </section>;
      })}</div>
    </section>
  </main>;
}
