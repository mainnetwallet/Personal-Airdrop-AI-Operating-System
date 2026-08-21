import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Creates a Drizzle client bound to the given connection string.
 * Callers are responsible for closing `sql` (the underlying postgres.js
 * client) on shutdown.
 */
export function createDatabase(connectionString: string) {
  const sql = postgres(connectionString, { max: 10 });
  const db = drizzle(sql, { schema });
  return { db, sql };
}

export * as schema from "./schema.js";
