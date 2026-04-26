import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Lazy: Next.js's "Collecting page data" step at build time imports route
// handlers without env, so we can't crash at module load. We initialize the
// pool on first access at runtime when DATABASE_URL is guaranteed to be set.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function init() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { max: 10, prepare: false });
  _db = drizzle(client, { schema });
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_t, prop) {
    return Reflect.get(init() as object, prop);
  },
});
export { schema };
