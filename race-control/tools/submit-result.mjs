import { readFile } from "node:fs/promises";
const [eventId, resultFile] = process.argv.slice(2);
if (!/^[0-9a-f-]{36}$/i.test(eventId ?? "") || !resultFile || !process.env.RACE_COMPETITION_KEY)
  throw new Error("Set RACE_COMPETITION_URL and RACE_COMPETITION_KEY, then provide the event UUID and result JSON path.");
const origin = new URL(process.env.RACE_COMPETITION_URL);
if (origin.username || origin.password ||
    (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost","127.0.0.1","[::1]"].includes(origin.hostname))))
  throw new Error("Use the competition's verified HTTPS origin.");
const response = await fetch(new URL("/api/v1/events/"+eventId+"/results",origin),{
  method:"POST",redirect:"error",signal:AbortSignal.timeout(10000),
  headers:{Authorization:"Bearer "+process.env.RACE_COMPETITION_KEY,"Content-Type":"application/json"},
  body:await readFile(resultFile,"utf8")
});
console.log(response.status,await response.json());
if (!response.ok) process.exitCode=1;
