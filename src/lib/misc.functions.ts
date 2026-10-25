import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---- Notifications ----

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await import("@/integrations/turso/client.server");
    const { toPlainRows } = await import("@/integrations/turso/profile-helpers.server");
    const res = await db.execute({
      sql: "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
      args: [context.userId],
    });
    return toPlainRows(res.rows);
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await import("@/integrations/turso/client.server");
    await db.execute({
      sql: "UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0",
      args: [context.userId],
    });
    return { ok: true };
  });

// ---- Ratings ----

const RatingInput = z.object({
  order_id: z.string().uuid(),
  ratee_id: z.string().uuid(),
  stars: z.number().int().min(1).max(5),
  review: z.string().trim().optional(),
});

export const submitRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.infer<typeof RatingInput>) => RatingInput.parse(input))
  .handler(async ({ context, data }) => {
    const { db } = await import("@/integrations/turso/client.server");

    const order = (await db.execute({ sql: "SELECT * FROM orders WHERE id = ?", args: [data.order_id] })).rows[0];
    if (!order) throw new Error("Order not found.");
    const isParty = order.shop_id === context.userId || order.driver_id === context.userId;
    if (!isParty) throw new Error("You weren't part of this order.");
    if (order.status !== "delivered") throw new Error("You can only rate a completed order.");
    if (data.ratee_id !== order.shop_id && data.ratee_id !== order.driver_id) {
      throw new Error("Invalid rating target.");
    }

    const ratee_table = data.ratee_id === order.shop_id ? "shopkeepers" : "drivers";

    const tx = await db.transaction("write");
    try {
      await tx.execute({
        sql: "INSERT OR IGNORE INTO ratings (id, order_id, rater_id, ratee_id, stars, review) VALUES (?, ?, ?, ?, ?, ?)",
        args: [crypto.randomUUID(), data.order_id, context.userId, data.ratee_id, data.stars, data.review ?? null],
      });
      const agg = await tx.execute({
        sql: "SELECT COUNT(*) as cnt, AVG(stars) as avg FROM ratings WHERE ratee_id = ?",
        args: [data.ratee_id],
      });
      const cnt = Number(agg.rows[0]?.cnt ?? 0);
      const avg = Number(agg.rows[0]?.avg ?? 0);
      await tx.execute({
        sql: `UPDATE ${ratee_table} SET rating_count = ?, rating_avg = ? WHERE id = ?`,
        args: [cnt, Math.round(avg * 100) / 100, data.ratee_id],
      });
      await tx.commit();
    } finally {
      tx.close();
    }
    return { ok: true };
  });

// ---- Complaints ----

const ComplaintInput = z.object({
  order_id: z.string().uuid().optional(),
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
});

export const createComplaint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.infer<typeof ComplaintInput>) => ComplaintInput.parse(input))
  .handler(async ({ context, data }) => {
    const { db } = await import("@/integrations/turso/client.server");
    await db.execute({
      sql: "INSERT INTO complaints (id, user_id, order_id, subject, body) VALUES (?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), context.userId, data.order_id ?? null, data.subject, data.body],
    });
    return { ok: true };
  });

export const listMyComplaints = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await import("@/integrations/turso/client.server");
    const { toPlainRows } = await import("@/integrations/turso/profile-helpers.server");
    const res = await db.execute({
      sql: "SELECT * FROM complaints WHERE user_id = ? ORDER BY created_at DESC",
      args: [context.userId],
    });
    return toPlainRows(res.rows);
  });

export const listAllComplaints = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin, toPlainRows } = await import("@/integrations/turso/profile-helpers.server");
    await requireAdmin(context.userId);
    const { db } = await import("@/integrations/turso/client.server");
    const res = await db.execute("SELECT * FROM complaints ORDER BY created_at DESC LIMIT 200");
    return toPlainRows(res.rows);
  });

export const updateComplaintStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string; status: "open" | "resolved" | "closed"; admin_notes?: string }) => input)
  .handler(async ({ context, data }) => {
    const { requireAdmin, nowIso } = await import("@/integrations/turso/profile-helpers.server");
    await requireAdmin(context.userId);
    const { db } = await import("@/integrations/turso/client.server");
    await db.execute({
      sql: "UPDATE complaints SET status = ?, admin_notes = COALESCE(?, admin_notes), updated_at = ? WHERE id = ?",
      args: [data.status, data.admin_notes ?? null, nowIso(), data.id],
    });
    return { ok: true };
  });

// ---- App settings (admin) ----

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { db } = await import("@/integrations/turso/client.server");
    const { toPlain } = await import("@/integrations/turso/profile-helpers.server");
    const res = await db.execute("SELECT * FROM app_settings WHERE id = 1");
    return toPlain(res.rows[0]);
  });

const SettingsInput = z.object({
  delivery_radius_km: z.number().positive().optional(),
  request_expiry_minutes: z.number().int().positive().optional(),
  support_number: z.string().trim().optional(),
  notifications_enabled: z.boolean().optional(),
  latest_version_code: z.number().int().nonnegative().optional(),
  update_message: z.string().trim().optional(),
});

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.infer<typeof SettingsInput>) => SettingsInput.parse(input))
  .handler(async ({ context, data }) => {
    const { requireAdmin, nowIso } = await import("@/integrations/turso/profile-helpers.server");
    await requireAdmin(context.userId);
    const { db } = await import("@/integrations/turso/client.server");
    await db.execute({
      sql: `UPDATE app_settings SET
              delivery_radius_km = COALESCE(?, delivery_radius_km),
              request_expiry_minutes = COALESCE(?, request_expiry_minutes),
              support_number = COALESCE(?, support_number),
              notifications_enabled = COALESCE(?, notifications_enabled),
              latest_version_code = COALESCE(?, latest_version_code),
              update_message = COALESCE(?, update_message),
              updated_at = ? WHERE id = 1`,
      args: [
        data.delivery_radius_km ?? null, data.request_expiry_minutes ?? null, data.support_number ?? null,
        data.notifications_enabled === undefined ? null : data.notifications_enabled ? 1 : 0,
        data.latest_version_code ?? null, data.update_message ?? null, nowIso(),
      ],
    });
    return { ok: true };
  });

/** Public, unauthenticated on purpose — the installed app needs to check
 *  this before (or without) anyone being signed in. Only ever exposes the
 *  two version-check fields, never the rest of app_settings. */
export const getAppVersionInfo = createServerFn({ method: "GET" })
  .handler(async () => {
    const { db } = await import("@/integrations/turso/client.server");
    const res = await db.execute("SELECT latest_version_code, update_message FROM app_settings WHERE id = 1");
    const row = res.rows[0];
    return {
      latest_version_code: Number(row?.latest_version_code ?? 0),
      update_message: (row?.update_message as string | null) ?? null,
    };
  });

export const listAdminLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin, toPlainRows } = await import("@/integrations/turso/profile-helpers.server");
    await requireAdmin(context.userId);
    const { db } = await import("@/integrations/turso/client.server");
    const res = await db.execute("SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 200");
    return toPlainRows(res.rows);
  });

// ---- Device tokens (push) ----

export const registerDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { token: string; platform?: string }) => input)
  .handler(async ({ context, data }) => {
    const { db } = await import("@/integrations/turso/client.server");
    const { nowIso } = await import("@/integrations/turso/profile-helpers.server");
    await db.execute({
      sql: `INSERT INTO device_tokens (id, user_id, token, platform) VALUES (?, ?, ?, ?)
            ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, updated_at = ?`,
      args: [crypto.randomUUID(), context.userId, data.token, data.platform ?? "android", nowIso()],
    });
    return { ok: true };
  });

export const unregisterDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { token: string }) => input)
  .handler(async ({ context, data }) => {
    const { db } = await import("@/integrations/turso/client.server");
    await db.execute({
      sql: "DELETE FROM device_tokens WHERE user_id = ? AND token = ?",
      args: [context.userId, data.token],
    });
    return { ok: true };
  });
