import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Row } from "@libsql/client";

const ROLE = z.enum(["shopkeeper", "driver"]);

/**
 * Everything a freshly-authenticated client needs in one round trip:
 * profile row, every role the user holds, their last-selected dashboard
 * (for role switching), and their shop/driver business rows if any.
 */
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await import("@/integrations/turso/client.server");
    const { ensureProfile, getUserRoles, toPlain } = await import(
      "@/integrations/turso/profile-helpers.server"
    );

    const profile = await ensureProfile(context.claims as { sub: string; email?: string });
    const roles = await getUserRoles(context.userId);

    const [prefRes, shopRes, driverRes] = await Promise.all([
      db.execute({
        sql: "SELECT active_role FROM account_preferences WHERE user_id = ?",
        args: [context.userId],
      }),
      roles.includes("shopkeeper")
        ? db.execute({ sql: "SELECT * FROM shopkeepers WHERE id = ?", args: [context.userId] })
        : Promise.resolve({ rows: [] as Row[] }),
      roles.includes("driver")
        ? db.execute({ sql: "SELECT * FROM drivers WHERE id = ?", args: [context.userId] })
        : Promise.resolve({ rows: [] as Row[] }),
    ]);

    return {
      profile,
      roles,
      activeRole: (prefRes.rows[0]?.active_role as string | undefined) ?? null,
      shop: toPlain(shopRes.rows[0]),
      driver: toPlain(driverRes.rows[0]),
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { full_name?: string; phone?: string; whatsapp?: string }) => input)
  .handler(async ({ context, data }) => {
    const { db } = await import("@/integrations/turso/client.server");
    const { nowIso } = await import("@/integrations/turso/profile-helpers.server");
    await db.execute({
      sql: "UPDATE profiles SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone), whatsapp = COALESCE(?, whatsapp), updated_at = ? WHERE id = ?",
      args: [data.full_name ?? null, data.phone ?? null, data.whatsapp ?? null, nowIso(), context.userId],
    });
    return { ok: true };
  });

/** Self-service role assignment — mirrors the Postgres policy that only ever
 *  allowed a user to grant themselves 'shopkeeper' or 'driver', never 'admin'. */
export const assignRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { role: "shopkeeper" | "driver" }) => ({ role: ROLE.parse(input.role) }))
  .handler(async ({ context, data }) => {
    const { db } = await import("@/integrations/turso/client.server");
    await db.execute({
      sql: "INSERT OR IGNORE INTO user_roles (id, user_id, role) VALUES (?, ?, ?)",
      args: [crypto.randomUUID(), context.userId, data.role],
    });
    return { ok: true };
  });
