// Server-only. Creates a notification row in Turso and pushes it to the
// recipient's registered devices in-process.
import { db } from "./client.server";
import { sendPushMessage } from "@/integrations/firebase/messaging.server";

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
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return; // push not configured; notification row still created

  const tokens = await db.execute({
    sql: "SELECT id, token FROM device_tokens WHERE user_id = ?",
    args: [userId],
  });
  if (tokens.rows.length === 0) return;

  for (const row of tokens.rows) {
    const token = row.token as string;
    const tokenId = row.id as string;
    const result = await sendPushMessage(token, title, body);
    if (!result.ok) {
      console.error(`[push] FCM send failed [${result.status}]: ${result.message}`);
      if (result.status === 404 || result.status === 400) {
        await db.execute({ sql: "DELETE FROM device_tokens WHERE id = ?", args: [tokenId] });
      }
    }
  }
}
