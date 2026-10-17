// Server-only. Creates a notification row in Turso and pushes it to the
// recipient's registered devices in-process. Replaces the old Postgres
// `pg_net` trigger (`dispatch_push_notification`) that posted to
// /api/public/push/send whenever a row was inserted into the (now-unused)
// Supabase `notifications` table — that trigger no longer fires because
// nothing writes to Postgres anymore, so this call site is the replacement.
import { db } from "./client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

export async function createNotification(
  userId: string,
  title: string,
  body: string,
  orderId?: string | null,
) {
  const id = crypto.randomUUID();
  await db.execute({
    sql: "INSERT INTO notifications (id, user_id, title, body, order_id) VALUES (?, ?, ?, ?, ?)",
    args: [id, userId, title, body, orderId ?? null],
  });
  await dispatchPush(userId, title, body).catch((err) => {
    console.error("[push] dispatch failed", err);
  });
  return id;
}

async function dispatchPush(userId: string, title: string, body: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connectionKey = process.env.FIREBASE_MESSAGING_API_KEY;
  if (!lovableKey || !connectionKey) return; // push not configured; notification row still created

  const tokens = await db.execute({
    sql: "SELECT id, token FROM device_tokens WHERE user_id = ?",
    args: [userId],
  });
  if (tokens.rows.length === 0) return;

  for (const row of tokens.rows) {
    const token = row.token as string;
    const tokenId = row.id as string;
    const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectionKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: { token, notification: { title, body }, data: { path: "/" } },
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[push] FCM send failed [${res.status}]: ${errText}`);
      if (res.status === 404 || res.status === 400) {
        await db.execute({ sql: "DELETE FROM device_tokens WHERE id = ?", args: [tokenId] });
      }
    }
  }
}
