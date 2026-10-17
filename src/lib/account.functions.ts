import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Switches which dashboard opens for this account without signing out.
 * Never grants a role or bypasses setup: if the target role has no business
 * row yet, the caller is told to run onboarding instead of being switched.
 * Blocks switching away from an active delivery so a driver can't abandon
 * an in-flight order mid-run.
 */
export const switchDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { role: "shopkeeper" | "driver" }) =>
    z.object({ role: z.enum(["shopkeeper", "driver"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { db } = await import("@/integrations/turso/client.server");
    const { hasRole, nowIso } = await import("@/integrations/turso/profile-helpers.server");
    const userId = context.userId;

    const driverRes = await db.execute({ sql: "SELECT is_busy FROM drivers WHERE id = ?", args: [userId] });
    const driver = driverRes.rows[0];
    if (driver?.is_busy) throw new Error("Finish your current delivery before switching roles.");

    const assignedRes = await db.execute({
      sql: "SELECT id FROM orders WHERE driver_id = ? AND status NOT IN ('delivered','cancelled','expired','no_driver_found') LIMIT 1",
      args: [userId],
    });
    if (assignedRes.rows.length > 0) {
      throw new Error("Finish your current delivery before switching roles.");
    }

    if (driver && data.role === "shopkeeper") {
      await db.execute({ sql: "UPDATE drivers SET is_online = 0 WHERE id = ?", args: [userId] });
    }

    const table = data.role === "driver" ? "drivers" : "shopkeepers";
    const profileRes = await db.execute({ sql: `SELECT id FROM ${table} WHERE id = ?`, args: [userId] });
    if (profileRes.rows.length === 0) return { needsSetup: true };

    if (!(await hasRole(userId, data.role))) {
      throw new Error("Your account role is not ready. Please contact support.");
    }

    await db.execute({
      sql: "INSERT INTO account_preferences (user_id, active_role) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET active_role = excluded.active_role, updated_at = ?",
      args: [userId, data.role, nowIso()],
    });
    return { needsSetup: false };
  });
