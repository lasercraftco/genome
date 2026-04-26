/**
 * Migration runner — invoked by the Dockerfile entrypoint before next starts.
 * Idempotent and quiet on success.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[migrate] DATABASE_URL not set — refusing to run");
    process.exit(1);
  }
  const folder = process.env.MIGRATIONS_DIR ?? "./migrations";
  console.log(`[migrate] running migrations from ${folder}`);
  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: folder });
  console.log("[migrate] migrations applied");
  await sql.end();
}

main().catch((e) => {
  console.error("[migrate] FAILED", e);
  process.exit(1);
});
