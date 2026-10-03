import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/platform";

let started = false;

/**
 * Native push notifications (Android via FCM).
 * Registers the device when a user is signed in and stores the FCM token
 * in public.device_tokens so the backend can target this phone.
 */
export function initPushNotifications() {
  if (started || !isNativeApp()) return;
  started = true;

  void supabase.auth.getUser().then(({ data }) => {
    if (data.user) void registerDevice(data.user.id);
  });

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user) {
      void registerDevice(session.user.id);
    }
  });
}

async function registerDevice(userId: string) {
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return;

    await PushNotifications.addListener("registration", async (token) => {
      try {
        await (supabase.from as (t: string) => ReturnType<typeof supabase.from>)(
          "device_tokens",
        ).upsert(
          {
            user_id: userId,
            token: token.value,
            platform: "android",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "token" },
        );
      } catch {
        /* token save failed; will retry on next launch */
      }
    });

    await PushNotifications.addListener("pushNotificationActionPerformed", () => {
      // Tapping a notification brings the app to the foreground; the
      // notification bell already shows the latest items.
    });

    await PushNotifications.register();
  } catch {
    /* push plugin unavailable */
  }
}
