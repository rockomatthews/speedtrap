import { database } from "../../../lib/db.mjs";
import { uuid } from "../../../lib/model.mjs";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function TV({ params }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const { rows:[event] } = await database().query(
    "SELECT name,phase,publication FROM race_control.events WHERE id=$1", [id]
  );
  if (!event) notFound();
  return <main><div className="hero"><div><h1>{event.name}</h1>
    <p>{event.phase === "review" && event.publication ? "Review in progress · Showing last official standings" : event.phase.replaceAll("_"," ")}</p></div>
    <a href="?refresh=1">Refresh standings</a>
  </div>
  {event.publication ? <div className="cards">
    <section className="panel"><h2>Qualifying</h2><ol>{event.publication.qualifying.map((row,index) =>
      <li key={index}>{row.driver} · {row.venue} <b>{(row.lapMs/1000).toFixed(3)} s</b></li>)}</ol></section>
    <section className="panel"><h2>Race results</h2><ol>{event.publication.race.map((row,index) =>
      <li key={index}>P{row.position} · {row.driver} · {row.venue}</li>)}</ol></section>
  </div> : <section className="panel"><p>Waiting for official results.</p></section>}
  </main>;
}
