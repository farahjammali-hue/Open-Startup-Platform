import pkg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import "dotenv/config";

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to fill it in the .env file?",
  );
}

const raw = process.env.DATABASE_URL;

// Decide SSL from the original string/host BEFORE we strip query params.
const needsSSL =
  /sslmode=require|sslmode=verify/.test(raw) ||
  /neon\.tech|supabase\.|render\.com|amazonaws\.com|azure\.com/.test(raw);

// Strip params the node-postgres driver either mishandles (channel_binding)
// or warns about (sslmode) — we set SSL explicitly on the Pool below instead.
function sanitizeConnectionString(input: string): string {
  try {
    const url = new URL(input);
    url.searchParams.delete("channel_binding");
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch {
    return input;
  }
}

const connectionString = sanitizeConnectionString(raw);

export const pool = new Pool({
  connectionString,
  ssl: needsSSL ? { rejectUnauthorized: false } : false,
});

export const db = drizzle(pool, { schema });
