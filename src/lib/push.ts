import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/platform";
import { registerDeviceToken, unregisterDeviceToken } from "@/lib/misc.functions";

export type PushStatus = "unsupported" | "prompt" | "denied" | "enabled" | "error";
let started = false;
let listenersReady: Promise<void> | null = null;
let registration: Promise<PushStatus> | null = null;
let currentToken: string | null = null;
let completeRegistration: ((status: PushStatus) => void) | null = null;

async function saveToken(token: string) {
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) throw new Error("Sign in before enabling notifications.");
  await registerDeviceToken({ data: { token, platform: "android" } });
  currentToken = token;
}

async function ensureListeners() {
  if (!listenersReady) listenersReady = (async () => {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.addListener("registration", async ({ value }) => {
      try { await saveToken(value); completeRegistration?.("enabled"); }
      catch { completeRegistration?.("error"); }
    });
    await PushNotifications.addListener("registrationError", () => completeRegistration?.("error"));
  })();
  return listenersReady;
}

export async function notificationStatus(): Promise<PushStatus> {
  if (!isNativeApp()) return "unsupported";
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const permission = await PushNotifications.checkPermissions();
    if (permission.receive === "granted") return "enabled";
    return permission.receive === "denied" ? "denied" : "prompt";
  } catch { return "error"; }
}

export async function enableNotifications(requestPermission = true): Promise<PushStatus> {
  if (!isNativeApp()) return "unsupported";
  if (registration) return registration;
  registration = (async () => {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      let permission = await PushNotifications.checkPermissions();
      if (requestPermission && (permission.receive === "prompt" || permission.receive === "prompt-with-rationale")) {
        permission = await PushNotifications.requestPermissions();
      }
      if (permission.receive !== "granted") return permission.receive === "denied" ? "denied" : "prompt";
      await ensureListeners();
      return await new Promise<PushStatus>((resolve) => {
        const timeout = setTimeout(() => { completeRegistration = null; resolve("error"); }, 15000);
        completeRegistration = (result) => { clearTimeout(timeout); completeRegistration = null; resolve(result); };
        void PushNotifications.register().catch(() => completeRegistration?.("error"));
      });
    } catch { return "error"; }
  })();
  try { return await registration; } finally { registration = null; }
}

export function initPushNotifications() {
  if (started || !isNativeApp()) return;
  started = true;
  // No Firebase project is configured for this app yet (no google-services.json),
  // so the native push plugin has nothing to register against. Calling
  // PushNotifications.register() in that state is a known cause of a hard native
  // crash on Android (FCM throwing because no FirebaseApp was initialized) — not
  // a catchable JS error, the whole app process dies. Previously this ran
  // automatically on every launch and on every sign-in, which is exactly what
  // was crashing the app right after login. Do nothing here until a real
  // Firebase project + google-services.json are added; the manual "Enable
  // notifications" button in settings is left as the only way to reach this
  // path, and should not be used until then either.
}

export async function unregisterDevice() {
  if (!currentToken) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) { currentToken = null; return; }
  try {
    await unregisterDeviceToken({ data: { token: currentToken } });
  } catch {
    throw new Error("Couldn't remove this phone's notifications. Please try signing out again.");
  }
  currentToken = null;
}
