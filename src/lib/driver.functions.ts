import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DriverInput = z.object({
  date_of_birth: z.string().optional(),
  home_address: z.string().trim().optional(),
  emergency_contact: z.string().trim().optional(),
  vehicle_type: z.enum(["walking", "cycle", "bike", "car"]),
  vehicle_number: z.string().trim().optional(),
  available_cash: z.number().nonnegative().optional(),
  bank_details: z.string().trim().optional(),
  search_radius_km: z.number().positive().optional(),
  gov_id_url: z.string().url().optional(),
  selfie_url: z.string().url().optional(),
  licence_url: z.string().url().optional(),
  rc_url: z.string().url().optional(),
  insurance_url: z.string().url().optional(),
  puc_url: z.string().url().optional(),
  payout_upi: z.string().trim().optional(),
});

export const getMyDriver = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await import("@/integrations/turso/client.server");
    const { toPlain } = await import("@/integrations/turso/profile-helpers.server");
    const res = await db.execute({ sql: "SELECT * FROM drivers WHERE id = ?", args: [context.userId] });
    return toPlain(res.rows[0]);
  });

/** Creates or updates the caller's own driver row and grants the `driver`
 *  role on first call — mirrors onboarding.tsx's previous combined
 *  upsert-driver + upsert-role Supabase call. */
export const upsertMyDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.infer<typeof DriverInput>) => DriverInput.parse(input))
  .handler(async ({ context, data }) => {
    const { db } = await import("@/integrations/turso/client.server");
    const { nowIso } = await import("@/integrations/turso/profile-helpers.server");

    await db.execute({
      sql: `INSERT INTO drivers
              (id, date_of_birth, home_address, emergency_contact, vehicle_type, vehicle_number,
               available_cash, bank_details, search_radius_km, gov_id_url, selfie_url, licence_url,
               rc_url, insurance_url, puc_url, payout_upi)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              date_of_birth = excluded.date_of_birth, home_address = excluded.home_address,
              emergency_contact = excluded.emergency_contact, vehicle_type = excluded.vehicle_type,
              vehicle_number = excluded.vehicle_number,
              available_cash = COALESCE(excluded.available_cash, drivers.available_cash),
              bank_details = COALESCE(excluded.bank_details, drivers.bank_details),
              search_radius_km = COALESCE(excluded.search_radius_km, drivers.search_radius_km),
              gov_id_url = COALESCE(excluded.gov_id_url, drivers.gov_id_url),
              selfie_url = COALESCE(excluded.selfie_url, drivers.selfie_url),
              licence_url = COALESCE(excluded.licence_url, drivers.licence_url),
              rc_url = COALESCE(excluded.rc_url, drivers.rc_url),
              insurance_url = COALESCE(excluded.insurance_url, drivers.insurance_url),
              puc_url = COALESCE(excluded.puc_url, drivers.puc_url),
              payout_upi = excluded.payout_upi, updated_at = ?`,
      args: [
        context.userId, data.date_of_birth ?? null, data.home_address ?? null, data.emergency_contact ?? null,
        data.vehicle_type, data.vehicle_number ?? null, data.available_cash ?? 0, data.bank_details ?? null,
        data.search_radius_km ?? null, data.gov_id_url ?? null, data.selfie_url ?? null, data.licence_url ?? null,
        data.rc_url ?? null, data.insurance_url ?? null, data.puc_url ?? null, data.payout_upi ?? null, nowIso(),
      ],
    });
    await db.execute({
      sql: "INSERT OR IGNORE INTO user_roles (id, user_id, role) VALUES (?, ?, 'driver')",
      args: [crypto.randomUUID(), context.userId],
    });
    await db.execute({
      sql: "INSERT INTO account_preferences (user_id, active_role) VALUES (?, 'driver') ON CONFLICT(user_id) DO NOTHING",
      args: [context.userId],
    });
    return { ok: true };
  });

export const setDriverLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { lat: number; lng: number }) => input)
  .handler(async ({ context, data }) => {
    const { db } = await import("@/integrations/turso/client.server");
    const { nowIso } = await import("@/integrations/turso/profile-helpers.server");
    await db.execute({
      sql: "UPDATE drivers SET current_lat = ?, current_lng = ?, location_updated_at = ? WHERE id = ?",
      args: [data.lat, data.lng, nowIso(), context.userId],
    });
    return { ok: true };
  });

export const setDriverOnline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { isOnline: boolean }) => input)
  .handler(async ({ context, data }) => {
    const { db } = await import("@/integrations/turso/client.server");
    await db.execute({
      sql: "UPDATE drivers SET is_online = ? WHERE id = ?",
      args: [data.isOnline ? 1 : 0, context.userId],
    });
    return { ok: true };
  });

export const setSearchRadius = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { km: number }) => input)
  .handler(async ({ context, data }) => {
    const { db } = await import("@/integrations/turso/client.server");
    await db.execute({
      sql: "UPDATE drivers SET search_radius_km = ? WHERE id = ?",
      args: [data.km, context.userId],
    });
    return { ok: true };
  });

// ---- Admin ----

export const listDrivers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { status?: string } | undefined) => input ?? {})
  .handler(async ({ context, data }) => {
    const { requireAdmin, toPlainRows } = await import("@/integrations/turso/profile-helpers.server");
    await requireAdmin(context.userId);
    const { db } = await import("@/integrations/turso/client.server");
    const res = data.status
      ? await db.execute({
          sql: "SELECT d.*, p.full_name, p.email FROM drivers d JOIN profiles p ON p.id = d.id WHERE d.approval_status = ? ORDER BY d.created_at DESC",
          args: [data.status],
        })
      : await db.execute(
          "SELECT d.*, p.full_name, p.email FROM drivers d JOIN profiles p ON p.id = d.id ORDER BY d.created_at DESC",
        );
    return toPlainRows(res.rows);
  });

const StatusInput = z.object({
  id: z.string().uuid(),
  approval_status: z.enum(["pending", "approved", "rejected", "suspended", "blocked"]).optional(),
  verification_status: z.enum(["pending", "verified", "active", "rejected", "resubmit"]).optional(),
  verification_notes: z.string().optional(),
});

export const setDriverStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.infer<typeof StatusInput>) => StatusInput.parse(input))
  .handler(async ({ context, data }) => {
    const { requireAdmin, nowIso } = await import("@/integrations/turso/profile-helpers.server");
    await requireAdmin(context.userId);
    const { db } = await import("@/integrations/turso/client.server");
    await db.execute({
      sql: "UPDATE drivers SET approval_status = COALESCE(?, approval_status), verification_status = COALESCE(?, verification_status), verification_notes = COALESCE(?, verification_notes), updated_at = ? WHERE id = ?",
      args: [data.approval_status ?? null, data.verification_status ?? null, data.verification_notes ?? null, nowIso(), data.id],
    });
    await db.execute({
      sql: "INSERT INTO admin_logs (id, admin_id, action, target_type, target_id, metadata) VALUES (?, ?, ?, 'driver', ?, ?)",
      args: [crypto.randomUUID(), context.userId, "update_driver_status", data.id, JSON.stringify(data)],
    });
    return { ok: true };
  });
