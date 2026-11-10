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

/**
 * Opens this app's OS settings screen (Android: the "App info" page) so the
 * user can flip a permission they previously denied. @capacitor/app has no
 * such method — it was never capable of this despite the old code calling
 * a nonexistent `App.openUrl`, which silently no-op'd instead of erroring.
 * Falls back to `false` when unavailable so callers can show guidance instead.
 */
export async function openAppSettings(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const { NativeSettings, AndroidSettings, IOSSettings } =
      await import("capacitor-native-settings");
    await NativeSettings.open({
      optionAndroid: AndroidSettings.ApplicationDetails,
      optionIOS: IOSSettings.App,
    });
    return true;
  } catch {
    return false;
  }
}
