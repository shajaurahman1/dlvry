import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const switchDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ role: z.enum(["shopkeeper", "driver"]) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: driver, error: driverError } = await supabase.from("drivers")
      .select("is_busy").eq("id", userId).maybeSingle();
    if (driverError) throw new Error(driverError.message);
    if (driver?.is_busy) throw new Error("Finish your current delivery before switching roles.");
    const { data: assignments, error: assignmentError } = await supabase.from("orders")
      .select("id").eq("driver_id", userId)
      .not("status", "in", "(delivered,cancelled,expired,no_driver_found)").limit(1);
    if (assignmentError) throw new Error(assignmentError.message);
    if (assignments?.length) throw new Error("Finish your current delivery before switching roles.");
    if (driver && data.role === "shopkeeper") {
      const { error } = await supabase.from("drivers")
        .update({ is_online: false, is_available: false }).eq("id", userId);
      if (error) throw new Error(error.message);
    }
    const table = data.role === "driver" ? "drivers" : "shopkeepers";
    const { data: profile, error: profileError } = await supabase.from(table)
      .select("id").eq("id", userId).maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) return { needsSetup: true };
    const { data: role, error: roleError } = await supabase.from("user_roles")
      .select("role").eq("user_id", userId).eq("role", data.role).maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!role) throw new Error("Your account role is not ready. Please contact support.");
    const { error } = await supabase.from("account_preferences")
      .upsert({ user_id: userId, active_role: data.role }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { needsSetup: false };
  });