import { createFileRoute } from "@tanstack/react-router";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

/**
 * Called by the database (pg_net trigger on notifications) whenever a new
 * notification row is created. Sends an FCM push to every registered device
 * of the notification's recipient. Secured with a shared secret header.
 */
export const Route = createFileRoute("/api/public/push/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-push-secret");
        if (!secret || secret !== process.env["PUSH_WEBHOOK_SECRET"]) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { notification_id?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        if (!body.notification_id) {
          return new Response("Bad request", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: notif } = await (supabaseAdmin.from as (t: string) => any)("notifications")
          .select("id,user_id,title,body,order_id")
          .eq("id", body.notification_id)
          .single();
        if (!notif) return new Response("Not found", { status: 404 });

        const { data: tokens } = await (supabaseAdmin.from as (t: string) => any)("device_tokens")
          .select("id,token")
          .eq("user_id", notif.user_id);
        if (!tokens?.length) return Response.json({ sent: 0 });

        const lovableKey = process.env["LOVABLE_API_KEY"];
        const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
        if (!lovableKey || !connectionKey) {
          throw new Error("Push gateway keys are not configured");
        }

        let sent = 0;
        for (const t of tokens as { id: string; token: string }[]) {
          const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableKey}`,
              "X-Connection-Api-Key": connectionKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: t.token,
                notification: { title: notif.title, body: notif.body },
                data: { path: "/" },
              },
            }),
          });
          if (res.ok) {
            sent++;
            continue;
          }
          const errText = await res.text();
          console.error(`FCM send failed [${res.status}]: ${errText}`);
          // Stale token — remove it instead of retrying forever.
          if (res.status === 404 || res.status === 400) {
            await (supabaseAdmin.from as (t: string) => any)("device_tokens")
              .delete()
              .eq("id", t.id);
          }
        }

        return Response.json({ sent });
      },
    },
  },
});
