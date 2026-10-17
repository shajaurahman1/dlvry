// Server-only helpers shared across Turso server functions.
import { db } from "./client.server";
import type { Row } from "@libsql/client";

/**
 * libSQL's Row objects carry hidden numeric-index duplicates of every column
 * (non-enumerable) alongside the named ones, and their declared type admits
 * ArrayBuffer — which TanStack Start's serializer type rejects as "may not
 * be serializable" even though none of our columns are ever blobs. Spreading
 * into a plain object keeps just the enumerable named columns and satisfies
 * the serializer; always return rows through this (or toPlainRows) instead
 * of handing a raw Row/Row[] back from a server function.
 */
type PlainRow = Record<string, string | number | null>;

export function toPlain<T extends PlainRow = PlainRow>(row: Row | undefined): T | null {
  return row ? ({ ...row } as unknown as T) : null;
}

export function toPlainRows<T extends PlainRow = PlainRow>(rows: Row[]): T[] {
  return rows.map((r) => ({ ...r }) as unknown as T);
}

export type Claims = { sub: string; email?: string; user_metadata?: { full_name?: string } };

/**
 * Lazily creates the profiles row for a just-authenticated Supabase user the
 * first time they hit any Turso-backed endpoint. Replaces the old Postgres
 * `handle_new_user` trigger (which fired on `auth.users` INSERT) — Turso has
 * no visibility into Supabase's `auth.users` table, so there is no DB-level
 * trigger equivalent; this call site is the replacement.
 */
export async function ensureProfile(claims: Claims) {
  const id = claims.sub;
  const existing = await db.execute({
    sql: "SELECT id, full_name, email, phone, whatsapp, avatar_url FROM profiles WHERE id = ?",
    args: [id],
  });
  if (existing.rows.length > 0) return toPlain(existing.rows[0]);

  const fullName = claims.user_metadata?.full_name ?? "";
  const email = claims.email ?? null;
  await db.execute({
    sql: "INSERT INTO profiles (id, full_name, email) VALUES (?, ?, ?)",
    args: [id, fullName, email],
  });
  const created = await db.execute({
    sql: "SELECT id, full_name, email, phone, whatsapp, avatar_url FROM profiles WHERE id = ?",
    args: [id],
  });
  return toPlain(created.rows[0]);
}

export async function getUserRoles(userId: string): Promise<string[]> {
  const res = await db.execute({
    sql: "SELECT role FROM user_roles WHERE user_id = ?",
    args: [userId],
  });
  return res.rows.map((r) => r.role as string);
}

export async function hasRole(userId: string, role: string): Promise<boolean> {
  const res = await db.execute({
    sql: "SELECT 1 FROM user_roles WHERE user_id = ? AND role = ? LIMIT 1",
    args: [userId, role],
  });
  return res.rows.length > 0;
}

export async function requireRole(userId: string, role: string) {
  if (!(await hasRole(userId, role))) {
    throw new Error(`Forbidden: missing role "${role}"`);
  }
}

export async function isAdmin(userId: string): Promise<boolean> {
  return hasRole(userId, "admin");
}

export async function requireAdmin(userId: string) {
  if (!(await isAdmin(userId))) throw new Error("Forbidden: admin only");
}

export function nowIso(): string {
  return new Date().toISOString();
}
