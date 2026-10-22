// Server-only Turso/libSQL client. Never import this from a route file or any
// module that ships to the client bundle — load it inside server functions:
//   const { db } = await import("@/integrations/turso/client.server");
import { createClient, type Client } from "@libsql/client";

function createTursoClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    const missing = [
      ...(!url ? ["TURSO_DATABASE_URL"] : []),
      ...(!authToken ? ["TURSO_AUTH_TOKEN"] : []),
    ];
    throw new Error(`Missing Turso environment variable(s): ${missing.join(", ")}`);
  }

  return createClient({ url, authToken });
}

let _db: Client | undefined;

export const db = new Proxy({} as Client, {
  get(_, prop) {
    if (!_db) _db = createTursoClient();
    const value = Reflect.get(_db, prop, _db);
    // libsql's client methods (e.g. batch()) read private class fields off
    // `this` — calling them as `db.batch(...)` through this proxy binds
    // `this` to the proxy itself unless we rebind to the real client here,
    // which throws "Cannot read private member ... from an object whose
    // class did not declare it".
    return typeof value === "function" ? value.bind(_db) : value;
  },
});
