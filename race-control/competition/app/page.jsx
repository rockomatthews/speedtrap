"use client";

import { useEffect, useState } from "react";

const stages = ["registration", "check_in", "qualifying", "race", "review", "published"];
const games = { rfactor_2: "rFactor 2", assetto_corsa: "Assetto Corsa", iracing: "iRacing" };
const label = value => value.replaceAll("_", " ");
const requiredDate = value => new Date(value).toISOString();
const formValues = event => {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget));
};
const presets = { rfactor_2: "Choose the server’s race event and package versions.", assetto_corsa: "Choose the installed car, layout, and build.", iracing: "Create the approved hosted session in iRacing and match the rules here." };

export default function Home() {
  const [events, setEvents] = useState([]);
  const [selected, select] = useState("");
  const [board, setBoard] = useState(null);
  const [token, setToken] = useState("");
  const [mode, setMode] = useState("");
  const [entries, setEntries] = useState([]);
  const [venues, setVenues] = useState([]);
  const [review, setReview] = useState([]);
  const [notice, setNotice] = useState("");
  const [issued, setIssued] = useState(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("lap");
  const [game, setGame] = useState("rfactor_2");
  const event = events.find(item => item.id === selected);
  const endpoint = "/events/" + selected;

  async function api(path, data, credential = token) {
    const response = await fetch("/api/v1" + path, {
      method: data === undefined ? "GET" : "POST", cache: "no-store",
      headers: { ...(credential ? { Authorization: "Bearer " + credential } : {}), "Content-Type": "application/json" },
      ...(data === undefined ? {} : { body: JSON.stringify(data) })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Request failed.");
    return result;
  }
  async function refresh(path = selected, credential = token, role = mode) {
    const list = await api("/events", undefined, "");
    setEvents(list);
    if (!path) return;
    const tasks = [api("/events/" + path + "/standings", undefined, "").then(setBoard)];
    if (credential && role) tasks.push(api("/events/" + path + "/entries", undefined, credential).then(setEntries));
    if (role === "organizer") tasks.push(api("/events/" + path + "/review", undefined, credential).then(setReview));
    await Promise.all(tasks);
  }
  useEffect(() => { refresh().catch(error => setNotice(error.message)); }, []);
  useEffect(() => {
    if (!selected) return;
    setEntries([]); setReview([]); setBoard(null);
    refresh(selected).catch(error => setNotice(error.message));
  }, [selected]);
  useEffect(() => {
    if (!selected || mode) return;
    const poll = setInterval(() => refresh(selected).catch(error => setNotice(error.message)), 10000);
    return () => clearInterval(poll);
  }, [selected, mode]);
  async function run(fn, message) {
    if (busy) return;
    setBusy(true);
    try { await fn(); setNotice(message ?? "Saved."); }
    catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }
  const submit = (fn, message) => event => {
    const values = formValues(event);
    run(() => fn(values), message);
  };

  async function signIn({ key, role }) {
    if (role === "organizer") setVenues(await api("/venues", undefined, key));
    else if (selected) await api(endpoint + "/entries", undefined, key);
    else throw new Error("Select an event before opening the venue portal.");
    setToken(key);
    setMode(role);
    await refresh(selected, key, role);
  }
  function copy(value) {
    run(() => navigator.clipboard.writeText(value), "ID copied.");
  }
  function signOut() {
    setToken(""); setMode(""); setEntries([]); setReview([]); setIssued(null); setNotice("Signed out.");
  }

  return <main>
    <section className="hero"><div><h1>Race Control</h1><p>Event entry, race review, and official standings.</p></div>
      <button onClick={() => run(() => refresh(), "Updated.")} disabled={busy}>Refresh</button></section>
    <p className="notice" role="status" aria-live="polite">{notice}</p>
    <section className="panel">
      <h2>Events</h2>
      <div className="cards">{events.map(item => <button type="button" className="event" key={item.id}
        aria-pressed={selected === item.id} onClick={() => select(item.id)}>
        <strong>{item.name}</strong><span>{games[item.game]} · {item.track}</span><small>{label(item.phase)}</small>
      </button>)}</div>
      {!events.length && <p>No test events have been scheduled.</p>}
      {event && <div className="event-details">
        <h3>{event.name}</h3><p>{event.car} · {event.track} · {event.build}</p>
        <p>{new Date(event.starts_at).toLocaleString()} to {new Date(event.ends_at).toLocaleString()}</p>
        <p>{event.rules}</p>
        <p><a href={"/tv/" + event.id}>Open TV standings</a></p>
        {mode && <button onClick={() => copy(event.id)}>Copy event ID</button>}
        {board?.board ? <div className="cards">
          <Board title="Qualifying" rows={board.board.qualifying} score={row => (row.lapMs / 1000).toFixed(3) + " s"} />
          <Board title="Race results" rows={board.board.race} score={row => "P" + row.position} />
        </div> : <p>Official standings will appear after review.</p>}
      </div>}
    </section>

    {!mode ? <section className="panel"><h2>Staff and venue access</h2>
      <form onSubmit={submit(signIn, "Access granted.")}>
        <label>Role <select name="role"><option value="organizer">Organizer</option><option value="venue">Venue operator</option></select></label>
        <label>Access key <input required name="key" type="password" autoComplete="current-password" /></label>
        <button disabled={busy}>Open controls</button>
      </form>
    </section> : <section className="panel">
      <div className="split"><h2>{mode === "organizer" ? "Organizer controls" : "Venue portal"}</h2><button onClick={signOut}>Sign out</button></div>
      {mode === "organizer" && <>
        <details><summary>Schedule an event</summary>
          <form onSubmit={submit(async input => {
            const result = await api("/events", { ...input, startsAt:requiredDate(input.startsAt), endsAt:requiredDate(input.endsAt), allowAttested:input.allowAttested === "on" });
            await refresh(result.id);
            select(result.id);
          }, "Event scheduled.")}>
            <Field name="name" title="Event name" />
            <label>Game <select name="game" value={game} onChange={e => setGame(e.target.value)}>{Object.entries(games).map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
            <Field name="track" title="Track or layout" /><Field name="car" title="Car" /><Field name="build" title="Game/content build" />
            <Field name="startsAt" title="Starts" type="datetime-local" /><Field name="endsAt" title="Ends" type="datetime-local" />
            <label>Rules <textarea name="rules" maxLength={2000} required placeholder={presets[game]} /></label>
            <label className="checkbox"><input name="allowAttested" type="checkbox" /> Allow steward-reviewed staff evidence</label>
            <button disabled={busy}>Schedule event</button>
          </form>
        </details>
        <details><summary>Issue a venue credential</summary>
          <form onSubmit={submit(async input => {
            const key = await api("/venues",input);
            setIssued(key);
            setVenues(await api("/venues"));
          }, "Venue credential created. Copy it now.")}>
            <Field name="name" title="Venue name" />
            <label>Provider <select name="provider">{["desk","vms","multitap","partner","staff"].map(p => <option key={p}>{p}</option>)}</select></label>
            <button disabled={busy}>Issue key</button>
          </form>
          {issued && <p>Credential {issued.credentialId}<br/><code className="secret">{issued.key}</code></p>}
          <form onSubmit={submit(async input => { await api("/credentials/" + input.credentialId + "/revoke", {}); setIssued(null); }, "Credential revoked.")}>
            <Field name="credentialId" title="Credential ID" /><button disabled={busy}>Revoke key</button>
          </form>
        </details>
      </>}
      {event && <>
        {mode === "organizer" && <div className="split"><p>Current phase: <b>{label(event.phase)}</b></p>
          {event.phase && <button disabled={busy} onClick={() => run(async () => {
            const phase = event.phase === "published" ? "review" : stages[stages.indexOf(event.phase) + 1];
            await api(endpoint + "/phase", { phase });
            await refresh();
          }, "Phase updated.")}>{event.phase === "published" ? "Reopen review" : "Advance to " + label(stages[stages.indexOf(event.phase) + 1])}</button>}
        </div>}
        <details open><summary>Entries and check-in</summary>
          <form onSubmit={submit(async ({ alias,externalId,venueId,consent }) => {
            await api(endpoint + "/entries",{ alias,externalId,...(venueId ? { venueId } : {}),consentToPublish:consent === "on" });
            await refresh();
          }, "Entry registered.")}>
            <Field name="alias" title="Driver’s public display name" /><Field name="externalId" title="Venue driver ID" />
            {mode === "organizer" && <VenueSelect venues={venues} />}
            <label className="checkbox"><input name="consent" type="checkbox" required /> Driver agrees to publish their alias and venue</label><button disabled={busy}>Register</button>
          </form>
          <ul>{entries.map(entry => <li key={entry.id}>{entry.alias} · {entry.venue}{" "}
            {entry.checked_in_at ? <button onClick={() => copy(entry.id)}>Copy checked-in entry ID</button> : <button disabled={busy || !["check_in","qualifying"].includes(event.phase)} onClick={() => run(async () => {
              await api(endpoint + "/check-in/" + entry.id, {});
              await refresh();
            }, "Driver checked in.")}>Check in</button>}
          </li>)}</ul>
        </details>
        <details><summary>Submit a result</summary>
          <form onSubmit={submit(async input => {
            const entry = entries.find(row => row.id === input.entryId);
            const result = await api(endpoint + "/results", {
              entryId:input.entryId,...(mode === "organizer" ? { venueId:entry?.venue_id } : {}),
              sourceId:input.sourceId,revision:Number(input.revision),kind, game:event.game, track:input.track, car:input.car, build:input.build,
              occurredAt:requiredDate(input.occurredAt), valid:input.valid === "on",
              ...(kind === "lap" ? { lapMs:Number(input.score) } : { position:Number(input.score) }),
              provenance:input.provenance,evidence:input.evidence
            });
            await refresh();
            if (result.issue) throw new Error("Saved for review. " + result.issue);
          }, "Result received for steward review.")}>
            <label>Driver <select name="entryId" required><option value="">Select a checked-in driver</option>
              {entries.filter(entry => entry.checked_in_at).map(entry => <option value={entry.id} key={entry.id}>{entry.alias} · {entry.venue}</option>)}
            </select></label>
            <label>Result type <select value={kind} onChange={e => setKind(e.target.value)}><option value="lap">Qualifying lap</option><option value="finish">Race finish</option></select></label>
            <Field name="score" title={kind === "lap" ? "Lap time in milliseconds" : "Finishing position"} type="number" />
            <Field name="sourceId" title="Unique source result ID" />
            <Field name="revision" title="Revision" type="number" defaultValue="1" />
            <Field key={event.id + "track"} name="track" title="Actual track" defaultValue={event.track} />
            <Field key={event.id + "car"} name="car" title="Actual car" defaultValue={event.car} />
            <Field key={event.id + "build"} name="build" title="Actual game/content build" defaultValue={event.build} />
            <Field name="occurredAt" title="Result time" type="datetime-local" />
            <label>Source <select name="provenance">
              <option value="game_export">Game export</option>
              {mode === "organizer" ? <option value="staff_attested">Staff attestation</option> : <option value="provider_feed">Provider feed</option>}
            </select></label>
            <label>Evidence reference <input required name="evidence" maxLength={800} /></label>
            <label className="checkbox"><input name="valid" type="checkbox" defaultChecked /> Valid result</label>
            <button disabled={busy}>Send for review</button>
          </form>
        </details>
        {mode === "organizer" && <details open><summary>Steward review</summary><ul>
          {review.map(row => <li key={row.id}>
            <b>{row.alias}</b> · {row.venue} · {row.payload.kind === "lap" ? row.payload.lapMs + " ms" : "P" + row.payload.position} · revision {row.revision} · {row.review}
            <p>{row.issue ?? row.payload.evidence}</p>
            <form onSubmit={submit(async input => { await api(endpoint + "/review/" + row.id,input); await refresh(); }, "Review saved.")}>
              <label>Decision <select name="decision">{!row.issue && <option value="accepted">Accept</option>}<option value="rejected">Reject</option></select></label>
              <label>Steward note <input required name="note" maxLength={500} /></label><button disabled={busy}>Save decision</button>
            </form>
          </li>)}</ul>{!review.length && <p>No results to review.</p>}</details>}
      </>}
    </section>}
  </main>;
}
function Field({ name,title,type="text",defaultValue }) {
  return <label>{title}<input required name={name} type={type} defaultValue={defaultValue} maxLength={type === "text" ? 120 : undefined} min={type === "number" ? 1 : undefined} /></label>;
}
function VenueSelect({ venues }) {
  return <label>Venue<select required name="venueId"><option value="">Select venue</option>{venues.map(venue => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label>;
}
function Board({ title, rows, score }) {
  return <div><h3>{title}</h3><ol>{rows.map((row,index) => <li key={index}>{row.driver} · {row.venue} · <b>{score(row)}</b></li>)}</ol></div>;
}
