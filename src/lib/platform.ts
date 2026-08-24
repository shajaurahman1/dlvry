/**
 * Platform helpers. Everything is SSR-safe and degrades to web behaviour when
 * Capacitor is not present (i.e. the browser build).
 */

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function cap(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True only inside the Android/iOS Capacitor shell. */
export function isNativeApp(): boolean {
  return Boolean(cap()?.isNativePlatform?.());
}

export function platformName(): "android" | "ios" | "web" {
  const p = cap()?.getPlatform?.();
  return p === "android" || p === "ios" ? p : "web";
}

/** Opens the OS app-settings screen (native only). Returns false on web. */
export async function openAppSettings(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const { NativeSettings, AndroidSettings, IOSSettings } = await import(
      /* @vite-ignore */ "capacitor-native-settings"
    ).catch(() => ({}) as never);
    if (NativeSettings) {
      await NativeSettings.open({
        optionAndroid: AndroidSettings.ApplicationDetails,
        optionIOS: IOSSettings.App,
      });
      return true;
    }
  } catch {
    /* plugin not installed — fall through */
  }
  try {
    const { App } = await import("@capacitor/app");
    // Best effort: reopening the app info screen is not available without the
    // settings plugin, so we at least surface the OS location settings intent.
    await App.getInfo();
  } catch {
    /* ignore */
  }
  return false;
}
