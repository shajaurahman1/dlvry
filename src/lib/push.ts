import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/platform";

export type PushStatus = "unsupported" | "prompt" | "denied" | "enabled" | "error";
let started = false;
let listenersReady: Promise<void> | null = null;
let registration: Promise<PushStatus> | null = null;
let currentToken: string | null = null;
let completeRegistration: ((status: PushStatus) => void) | null = null;

async function saveToken(token: string) {
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) throw new Error("Sign in before enabling notifications.");
  const { error } = await supabase.from("device_tokens").upsert(
    {
      user_id: data.user.id,
      token,
      platform: "android",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );
  if (error) throw new Error(error.message);
  currentToken = token;
}

async function ensureListeners() {
  if (!listenersReady)
    listenersReady = (async () => {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      await PushNotifications.addListener("registration", async ({ value }) => {
        try {
          await saveToken(value);
          completeRegistration?.("enabled");
        } catch {
          completeRegistration?.("error");
        }
      });
      await PushNotifications.addListener("registrationError", () =>
        completeRegistration?.("error"),
      );
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
  } catch {
    return "error";
  }
}

export async function enableNotifications(requestPermission = true): Promise<PushStatus> {
  if (!isNativeApp()) return "unsupported";
  if (registration) return registration;
  registration = (async () => {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      let permission = await PushNotifications.checkPermissions();
      if (
        requestPermission &&
        (permission.receive === "prompt" || permission.receive === "prompt-with-rationale")
      ) {
        permission = await PushNotifications.requestPermissions();
      }
      if (permission.receive !== "granted")
        return permission.receive === "denied" ? "denied" : "prompt";
      await ensureListeners();
      return await new Promise<PushStatus>((resolve) => {
        const timeout = setTimeout(() => {
          completeRegistration = null;
          resolve("error");
        }, 15000);
        completeRegistration = (result) => {
          clearTimeout(timeout);
          completeRegistration = null;
          resolve(result);
        };
        void PushNotifications.register().catch(() => completeRegistration?.("error"));
      });
    } catch {
      return "error";
    }
  })();
  try {
    return await registration;
  } finally {
    registration = null;
  }
}

export function initPushNotifications() {
  if (started || !isNativeApp()) return;
  started = true;
  // Never prompt on launch. Only restore registration when already permitted.
  void supabase.auth.getUser().then(({ data }) => {
    if (data.user) void enableNotifications(false);
  });
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user)
      setTimeout(() => void enableNotifications(false), 0);
  });
}

export async function unregisterDevice() {
  if (!currentToken) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    currentToken = null;
    return;
  }
  const { error } = await supabase
    .from("device_tokens")
    .delete()
    .eq("user_id", data.user.id)
    .eq("token", currentToken);
  if (error)
    throw new Error("Couldn't remove this phone's notifications. Please try signing out again.");
  currentToken = null;
}
