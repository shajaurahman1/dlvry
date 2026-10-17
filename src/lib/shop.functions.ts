import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ShopInput = z.object({
  shop_name: z.string().trim().min(1),
  shop_category: z.string().trim().min(1),
  address: z.string().trim().min(1),
  latitude: z.number(),
  longitude: z.number(),
  owner_name: z.string().trim().optional(),
  shop_phone: z.string().trim().optional(),
  gst_number: z.string().trim().optional(),
  pan_number: z.string().trim().optional(),
  licence_number: z.string().trim().optional(),
  gov_id_url: z.string().url().optional(),
  shop_photo_url: z.string().url().optional(),
  trade_license_url: z.string().url().optional(),
});

export const getMyShop = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await import("@/integrations/turso/client.server");
    const { toPlain } = await import("@/integrations/turso/profile-helpers.server");
    const res = await db.execute({
      sql: "SELECT * FROM shopkeepers WHERE id = ?",
      args: [context.userId],
    });
    return toPlain(res.rows[0]);
  });

/** Creates or updates the caller's own shop row and grants the `shopkeeper`
 *  role on first call — mirrors onboarding.tsx's previous combined
 *  upsert-shop + upsert-role Supabase call. Status columns are never
 *  writable here; only an admin endpoint can change approval/verification. */
export const upsertMyShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.infer<typeof ShopInput>) => ShopInput.parse(input))
  .handler(async ({ context, data }) => {
    const { db } = await import("@/integrations/turso/client.server");
    const { nowIso } = await import("@/integrations/turso/profile-helpers.server");

    await db.execute({
      sql: `INSERT INTO shopkeepers
              (id, shop_name, shop_category, address, latitude, longitude, owner_name, shop_phone,
               gst_number, pan_number, licence_number, gov_id_url, shop_photo_url, trade_license_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              shop_name = excluded.shop_name, shop_category = excluded.shop_category,
              address = excluded.address, latitude = excluded.latitude, longitude = excluded.longitude,
              owner_name = excluded.owner_name, shop_phone = excluded.shop_phone,
              gst_number = excluded.gst_number, pan_number = excluded.pan_number,
              licence_number = excluded.licence_number,
              gov_id_url = COALESCE(excluded.gov_id_url, shopkeepers.gov_id_url),
              shop_photo_url = COALESCE(excluded.shop_photo_url, shopkeepers.shop_photo_url),
              trade_license_url = COALESCE(excluded.trade_license_url, shopkeepers.trade_license_url),
              updated_at = ?`,
      args: [
        context.userId, data.shop_name, data.shop_category, data.address, data.latitude, data.longitude,
        data.owner_name ?? null, data.shop_phone ?? null, data.gst_number ?? null, data.pan_number ?? null,
        data.licence_number ?? null, data.gov_id_url ?? null, data.shop_photo_url ?? null,
        data.trade_license_url ?? null, nowIso(),
      ],
    });
    await db.execute({
      sql: "INSERT OR IGNORE INTO user_roles (id, user_id, role) VALUES (?, ?, 'shopkeeper')",
      args: [crypto.randomUUID(), context.userId],
    });
    await db.execute({
      sql: "INSERT INTO account_preferences (user_id, active_role) VALUES (?, 'shopkeeper') ON CONFLICT(user_id) DO NOTHING",
      args: [context.userId],
    });
    return { ok: true };
  });

// ---- Admin ----

export const listShopkeepers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { status?: string } | undefined) => input ?? {})
  .handler(async ({ context, data }) => {
    const { requireAdmin, toPlainRows } = await import("@/integrations/turso/profile-helpers.server");
    await requireAdmin(context.userId);
    const { db } = await import("@/integrations/turso/client.server");
    const res = data.status
      ? await db.execute({
          sql: "SELECT s.*, p.full_name, p.email FROM shopkeepers s JOIN profiles p ON p.id = s.id WHERE s.approval_status = ? ORDER BY s.created_at DESC",
          args: [data.status],
        })
      : await db.execute(
          "SELECT s.*, p.full_name, p.email FROM shopkeepers s JOIN profiles p ON p.id = s.id ORDER BY s.created_at DESC",
        );
    return toPlainRows(res.rows);
  });

const StatusInput = z.object({
  id: z.string().uuid(),
  approval_status: z.enum(["pending", "approved", "rejected", "suspended", "blocked"]).optional(),
  verification_status: z.enum(["pending", "verified", "active", "rejected", "resubmit"]).optional(),
  verification_notes: z.string().optional(),
});

export const setShopkeeperStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.infer<typeof StatusInput>) => StatusInput.parse(input))
  .handler(async ({ context, data }) => {
    const { requireAdmin, nowIso } = await import("@/integrations/turso/profile-helpers.server");
    await requireAdmin(context.userId);
    const { db } = await import("@/integrations/turso/client.server");
    await db.execute({
      sql: "UPDATE shopkeepers SET approval_status = COALESCE(?, approval_status), verification_status = COALESCE(?, verification_status), updated_at = ? WHERE id = ?",
      args: [data.approval_status ?? null, data.verification_status ?? null, nowIso(), data.id],
    });
    await db.execute({
      sql: "INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, metadata) VALUES (?, ?, ?, 'shopkeeper', ?, ?)",
      args: [crypto.randomUUID(), context.userId, "update_shopkeeper_status", data.id, JSON.stringify(data)],
    });
    return { ok: true };
  });
