import pg from "pg";
let pool;
export function database() {
  if (!process.env.RACE_DATABASE_URL) throw new Error("RACE_DATABASE_URL is required");
  pool ??= new pg.Pool({
    connectionString: process.env.RACE_DATABASE_URL,
    ...(process.env.RACE_DATABASE_CA ? { ssl: { ca: process.env.RACE_DATABASE_CA, rejectUnauthorized: true } } : {}),
    max: 4,
    connectionTimeoutMillis: 4000,
    statement_timeout: 5000
  });
  return pool;
}

export async function tx(run) {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
