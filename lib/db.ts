import "server-only";

import { Pool, type QueryResultRow } from "pg";

declare global {
  var __vignetteDbPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be configured.");
  }

  return new Pool({
    connectionString,
    // Cloud SQL Unix sockets and local Postgres do not need SSL by default.
    // Set DATABASE_SSL=true when connecting over a public IP with SSL required.
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
    max: 10,
  });
}

export function getDbPool() {
  if (!globalThis.__vignetteDbPool) {
    globalThis.__vignetteDbPool = createPool();
  }
  return globalThis.__vignetteDbPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  return getDbPool().query<T>(text, params);
}

export function isPostgresError(
  error: unknown,
): error is { code: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}
