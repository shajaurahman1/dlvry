import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function genOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

const CreateOrderInput = z.object({
  customer_name: z.string().trim().min(1),
  customer_phone: z.string().trim().min(1),
  customer_address: z.string().trim().min(1),
  order_description: z.string().trim().min(1),
  order_amount: z.number().nonnegative(),
  delivery_charge: z.number().gt(10, "Delivery charge must be greater than ₹10"),
  pickup_notes: z.string().trim().optional(),
  pickup_lat: z.number(),
  pickup_lng: z.number(),
  customer_lat: z.number().optional(),
  customer_lng: z.number().optional(),
  payment_method: z.enum(["cash", "upi"]).default("cash"),
});

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.infer<typeof CreateOrderInput>) => CreateOrderInput.parse(input))
  .handler(async ({ context, data }) => {
    const { db } = await import("@/integrations/turso/client.server");
    const { requireRole, nowIso } = await import("@/integrations/turso/profile-helpers.server");
    await requireRole(context.userId, "shopkeeper");

    const shopRes = await db.execute({
      sql: "SELECT approval_status FROM shopkeepers WHERE id = ?",
      args: [context.userId],
    });
    const shop = shopRes.rows[0];
    if (!shop || shop.approval_status !== "approved") {
      throw new Error("Your shop isn't approved yet — you can't send delivery requests.");
    }

    const settingsRes = await db.execute("SELECT delivery_radius_km, request_expiry_minutes FROM app_settings WHERE id = 1");
    const settings = settingsRes.rows[0] ?? { delivery_radius_km: 3, request_expiry_minutes: 10 };
    const radiusKm = Number(settings.delivery_radius_km ?? 3);
    const expiryMin = Number(settings.request_expiry_minutes ?? 10);

    const id = crypto.randomUUID();
    const otp = genOtp();
    const now = nowIso();
    const expiresAt = new Date(Date.now() + expiryMin * 60_000).toISOString();

    await db.execute({
      sql: `INSERT INTO orders
              (id, shop_id, customer_name, customer_phone, customer_address, order_description,
               order_amount, delivery_charge, pickup_notes, pickup_lat, pickup_lng, customer_lat,
               customer_lng, payment_method, status, delivery_otp, expires_at, radius_km, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'searching', ?, ?, ?, ?, ?)`,
      args: [
        id, context.userId, data.customer_name, data.customer_phone, data.customer_address,
        data.order_description, data.order_amount, data.delivery_charge, data.pickup_notes ?? null,
        data.pickup_lat, data.pickup_lng, data.customer_lat ?? null, data.customer_lng ?? null,
        data.payment_method, otp, expiresAt, radiusKm, now, now,
      ],
    });
    await db.execute({
      sql: "INSERT INTO order_status_history (id, order_id, status, changed_by) VALUES (?, ?, 'searching', ?)",
      args: [crypto.randomUUID(), id, context.userId],
    });
    return { id, delivery_otp: otp };
  });

export const listShopOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireRole, toPlainRows } = await import("@/integrations/turso/profile-helpers.server");
    await requireRole(context.userId, "shopkeeper");
    const { db } = await import("@/integrations/turso/client.server");
    const res = await db.execute({
      sql: `SELECT o.*, p.full_name AS driver_name, p.phone AS driver_phone
            FROM orders o
            LEFT JOIN profiles p ON p.id = o.driver_id
            WHERE o.shop_id = ? ORDER BY o.created_at DESC LIMIT 200`,
      args: [context.userId],
    });
    return toPlainRows(res.rows);
  });

export const listDriverOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireRole, toPlainRows } = await import("@/integrations/turso/profile-helpers.server");
    await requireRole(context.userId, "driver");
    const { db } = await import("@/integrations/turso/client.server");
    const res = await db.execute({
      sql: `SELECT o.*, s.shop_name, s.shop_phone, s.address AS shop_address
            FROM orders o JOIN shopkeepers s ON s.id = o.shop_id
            WHERE o.driver_id = ? ORDER BY o.created_at DESC LIMIT 200`,
      args: [context.userId],
    });
    return toPlainRows(res.rows);
  });

/** Flips orders nobody accepted before their expiry to 'no_driver_found' so
 *  the shop can resend. Cheap enough to call opportunistically from the
 *  driver dashboard's poll loop instead of needing a cron job. */
export const expireStaleOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { db } = await import("@/integrations/turso/client.server");
    const now = new Date().toISOString();
    await db.execute({
      sql: "UPDATE orders SET status = 'no_driver_found', updated_at = ? WHERE status = 'searching' AND expires_at IS NOT NULL AND expires_at < ?",
      args: [now, now],
    });
    return { ok: true };
  });

export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin, toPlainRows } = await import("@/integrations/turso/profile-helpers.server");
    await requireAdmin(context.userId);
    const { db } = await import("@/integrations/turso/client.server");
    const res = await db.execute("SELECT * FROM orders ORDER BY created_at DESC LIMIT 50");
    return toPlainRows(res.rows);
  });

/** Candidate orders within the driver's radius. Eligibility (online, not
 *  busy, approved, verified, fresh location, cash cap) is enforced
 *  server-side from the driver's own row — never trusted from the client. */
export const getNearbyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { lat: number; lng: number }) => input)
  .handler(async ({ context, data }) => {
    const { requireRole, toPlainRows } = await import("@/integrations/turso/profile-helpers.server");
    await requireRole(context.userId, "driver");
    const { db } = await import("@/integrations/turso/client.server");

    const driverRes = await db.execute({ sql: "SELECT * FROM drivers WHERE id = ?", args: [context.userId] });
    const driver = driverRes.rows[0];
    if (!driver) return [];
    if (driver.approval_status !== "approved") return [];
    if (!["verified", "active"].includes(String(driver.verification_status))) return [];
    if (!driver.is_online || driver.is_busy) return [];
    if (driver.location_updated_at) {
      const ageMs = Date.now() - new Date(String(driver.location_updated_at)).getTime();
      if (ageMs > 10 * 60_000) return [];
    }

    const nowIso = new Date().toISOString();
    const candidates = await db.execute({
      sql: `SELECT o.*, s.shop_name, s.shop_phone, s.address AS shop_address
            FROM orders o JOIN shopkeepers s ON s.id = o.shop_id
            WHERE o.status = 'searching' AND o.driver_id IS NULL
              AND (o.expires_at IS NULL OR o.expires_at > ?)
            ORDER BY o.created_at ASC LIMIT 100`,
      args: [nowIso],
    });

    const driverRadius = Number(driver.search_radius_km ?? 3);
    const availableCash = Number(driver.available_cash ?? 0);

    type Candidate = {
      pickup_lat: number; pickup_lng: number; radius_km: number;
      payment_method: string; order_amount: number; [key: string]: string | number | null;
    };

    return toPlainRows<Candidate>(candidates.rows)
      .map((o) => {
        const distanceKm = haversineKm(data.lat, data.lng, Number(o.pickup_lat), Number(o.pickup_lng));
        return { ...o, distance_km: distanceKm };
      })
      .filter((o) => {
        const orderRadius = Math.min(Number(o.radius_km ?? 3), driverRadius);
        if (o.distance_km > orderRadius) return false;
        if (o.payment_method === "cash" && Number(o.order_amount) > availableCash) return false;
        return true;
      })
      .sort((a, b) => a.distance_km - b.distance_km);
  });

export const acceptOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { orderId: string; lat: number; lng: number }) => input)
  .handler(async ({ context, data }) => {
    const { requireRole } = await import("@/integrations/turso/profile-helpers.server");
    await requireRole(context.userId, "driver");
    const { db } = await import("@/integrations/turso/client.server");
    const { createNotification } = await import("@/integrations/turso/notify.server");

    const driverRes = await db.execute({ sql: "SELECT * FROM drivers WHERE id = ?", args: [context.userId] });
    const driver = driverRes.rows[0];
    if (!driver || driver.approval_status !== "approved" || driver.is_busy) {
      throw new Error("You can't accept orders right now.");
    }

    const now = new Date().toISOString();
    const tx = await db.transaction("write");
    let shopId: string | null = null;
    try {
      const upd = await tx.execute({
        sql: "UPDATE orders SET driver_id = ?, status = 'going_to_shop', accepted_at = ?, updated_at = ? WHERE id = ? AND driver_id IS NULL AND status = 'searching'",
        args: [context.userId, now, now, data.orderId],
      });
      if (upd.rowsAffected === 0) {
        throw new Error("This order was already taken or is no longer available.");
      }
      const orderRes = await tx.execute({ sql: "SELECT shop_id FROM orders WHERE id = ?", args: [data.orderId] });
      shopId = (orderRes.rows[0]?.shop_id as string) ?? null;
      await tx.execute({ sql: "UPDATE drivers SET is_busy = 1 WHERE id = ?", args: [context.userId] });
      await tx.execute({
        sql: "INSERT INTO order_status_history (id, order_id, status, changed_by) VALUES (?, ?, 'going_to_shop', ?)",
        args: [crypto.randomUUID(), data.orderId, context.userId],
      });
      await tx.commit();
    } finally {
      tx.close();
    }

    if (shopId) {
      await createNotification(shopId, "Driver on the way", "A delivery partner accepted your order and is heading to your shop.", data.orderId);
    }
    return { ok: true };
  });

const DRIVER_TRANSITIONS: Record<string, string> = {
  going_to_shop: "arrived_at_shop",
  payment_received: "picked_up",
  picked_up: "going_to_customer",
  going_to_customer: "arrived_at_customer",
  arrived_at_customer: "delivered",
};

export const advanceOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { orderId: string; status: string; otp?: string }) => input)
  .handler(async ({ context, data }) => {
    const { db } = await import("@/integrations/turso/client.server");
    const { createNotification } = await import("@/integrations/turso/notify.server");

    const orderRes = await db.execute({ sql: "SELECT * FROM orders WHERE id = ?", args: [data.orderId] });
    const order = orderRes.rows[0];
    if (!order) throw new Error("Order not found.");
    if (order.driver_id !== context.userId) throw new Error("You are not assigned to this order.");

    const expected = DRIVER_TRANSITIONS[String(order.status)];
    if (!expected || expected !== data.status) {
      throw new Error(`Can't move from "${order.status}" to "${data.status}".`);
    }
    if (data.status === "delivered") {
      if (!data.otp || data.otp !== order.delivery_otp) {
        throw new Error("Incorrect delivery code.");
      }
    }

    const now = new Date().toISOString();
    const timestampCol: Record<string, string> = {
      arrived_at_shop: "reached_shop_at",
      picked_up: "picked_up_at",
      delivered: "delivered_at",
    };
    const col = timestampCol[data.status];

    const tx = await db.transaction("write");
    try {
      await tx.execute({
        sql: `UPDATE orders SET status = ?, updated_at = ?${col ? `, ${col} = ?` : ""}${
          data.status === "delivered" ? ", otp_verified = 1" : ""
        } WHERE id = ?`,
        args: col ? [data.status, now, now, data.orderId] : [data.status, now, data.orderId],
      });
      await tx.execute({
        sql: "INSERT INTO order_status_history (id, order_id, status, changed_by) VALUES (?, ?, ?, ?)",
        args: [crypto.randomUUID(), data.orderId, data.status, context.userId],
      });
      if (data.status === "delivered") {
        await tx.execute({ sql: "UPDATE drivers SET is_busy = 0 WHERE id = ?", args: [context.userId] });
      }
      await tx.commit();
    } finally {
      tx.close();
    }

    const messages: Record<string, string> = {
      arrived_at_shop: "Your delivery partner has arrived at your shop.",
      picked_up: "Your order has been picked up.",
      delivered: "Your order has been delivered!",
    };
    if (messages[data.status]) {
      await createNotification(String(order.shop_id), "Order update", messages[data.status], data.orderId);
    }
    return { ok: true };
  });

/** Shop confirms cash/UPI payment was received at pickup — the gate between
 *  "arrived_at_shop" and the driver being allowed to move to "picked_up". */
export const confirmPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { orderId: string }) => input)
  .handler(async ({ context, data }) => {
    const { db } = await import("@/integrations/turso/client.server");
    const { createNotification } = await import("@/integrations/turso/notify.server");
    const order = (await db.execute({ sql: "SELECT * FROM orders WHERE id = ?", args: [data.orderId] })).rows[0];
    if (!order) throw new Error("Order not found.");
    if (order.shop_id !== context.userId) throw new Error("Not your order.");
    if (order.status !== "arrived_at_shop") throw new Error("Payment can only be confirmed after the driver arrives.");

    const now = new Date().toISOString();
    await db.execute({
      sql: "UPDATE orders SET status = 'payment_received', payment_received_at = ?, updated_at = ? WHERE id = ?",
      args: [now, now, data.orderId],
    });
    await db.execute({
      sql: "INSERT INTO order_status_history (id, order_id, status, changed_by) VALUES (?, ?, 'payment_received', ?)",
      args: [crypto.randomUUID(), data.orderId, context.userId],
    });
    if (order.driver_id) {
      await createNotification(String(order.driver_id), "Payment confirmed", "The shop confirmed payment — you can pick up the order now.", data.orderId);
    }
    return { ok: true };
  });

export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { orderId: string; reason: string }) => input)
  .handler(async ({ context, data }) => {
    const { db } = await import("@/integrations/turso/client.server");
    const { createNotification } = await import("@/integrations/turso/notify.server");
    const order = (await db.execute({ sql: "SELECT * FROM orders WHERE id = ?", args: [data.orderId] })).rows[0];
    if (!order) throw new Error("Order not found.");
    if (order.shop_id !== context.userId) throw new Error("Not your order.");
    if (!["searching", "going_to_shop", "arrived_at_shop", "payment_received"].includes(String(order.status))) {
      throw new Error("This order can no longer be cancelled.");
    }

    const now = new Date().toISOString();
    const tx = await db.transaction("write");
    try {
      await tx.execute({
        sql: "UPDATE orders SET status = 'cancelled', cancelled_at = ?, cancel_reason = ?, updated_at = ? WHERE id = ?",
        args: [now, data.reason, now, data.orderId],
      });
      if (order.driver_id) {
        await tx.execute({ sql: "UPDATE drivers SET is_busy = 0 WHERE id = ?", args: [order.driver_id] });
      }
      await tx.execute({
        sql: "INSERT INTO order_status_history (id, order_id, status, changed_by) VALUES (?, ?, 'cancelled', ?)",
        args: [crypto.randomUUID(), data.orderId, context.userId],
      });
      await tx.commit();
    } finally {
      tx.close();
    }
    if (order.driver_id) {
      await createNotification(String(order.driver_id), "Order cancelled", "The shop cancelled this delivery request.", data.orderId);
    }
    return { ok: true };
  });

/** Re-broadcasts an order that nobody accepted in time. */
export const resendOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { orderId: string }) => input)
  .handler(async ({ context, data }) => {
    const { db } = await import("@/integrations/turso/client.server");
    const order = (await db.execute({ sql: "SELECT * FROM orders WHERE id = ?", args: [data.orderId] })).rows[0];
    if (!order) throw new Error("Order not found.");
    if (order.shop_id !== context.userId) throw new Error("Not your order.");
    if (!["no_driver_found", "expired"].includes(String(order.status))) {
      throw new Error("Only expired requests can be resent.");
    }

    const settingsRes = await db.execute("SELECT request_expiry_minutes FROM app_settings WHERE id = 1");
    const expiryMin = Number(settingsRes.rows[0]?.request_expiry_minutes ?? 10);
    const expiresAt = new Date(Date.now() + expiryMin * 60_000).toISOString();
    const now = new Date().toISOString();

    await db.execute({
      sql: "UPDATE orders SET status = 'searching', driver_id = NULL, delivery_otp = ?, expires_at = ?, updated_at = ? WHERE id = ?",
      args: [String(Math.floor(1000 + Math.random() * 9000)), expiresAt, now, data.orderId],
    });
    await db.execute({
      sql: "INSERT INTO order_status_history (id, order_id, status, changed_by) VALUES (?, ?, 'searching', ?)",
      args: [crypto.randomUUID(), data.orderId, context.userId],
    });
    return { ok: true };
  });
