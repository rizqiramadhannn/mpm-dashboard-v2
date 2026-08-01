import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

let db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export async function getDb() {
  if (db) {
    return db;
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken =
    process.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_DATABASE_TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error(
      "Turso database credentials are unavailable. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN or TURSO_DATABASE_TURSO_AUTH_TOKEN in your environment before using the database."
    );
  }

  db = drizzle(
    createClient({
      url,
      authToken,
    }),
    { schema }
  );

  return db;
}
