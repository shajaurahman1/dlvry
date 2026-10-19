
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error("Missing Turso database credentials");
}

const db = createClient({ url, authToken });

const schema = readFileSync(
  new URL("../turso/schema.sql", import.meta.url),
  "utf8"
);

// Split statements in our schema file.
// This works because the file contains no SQL triggers
// or procedural blocks with internal semicolons.
const statements = schema
  .split(";")
  .map((statement) =>
    statement
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim()
  )
  .filter(Boolean);

for (const statement of statements) {
  await db.execute(statement);
}

const result = await db.execute(`
  SELECT name
  FROM sqlite_master
  WHERE type = 'table'
    AND name NOT LIKE 'sqlite_%'
  ORDER BY name
`);

console.log("Tables created:");
for (const row of result.rows) {
  console.log(`- ${row.name}`);
}

console.log(`Total tables: ${result.rows.length}`);
