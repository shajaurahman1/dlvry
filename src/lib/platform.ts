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
 * Opens the OS settings screen for this app when running on Android.
 * Uses the Capacitor bridge's generic plugin call so no extra plugin is needed;
 * falls back to `false` when unavailable so callers can show guidance instead.
 */
export async function openAppSettings(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    const url = `package:${info.id}`;
    const anyWindow = window as unknown as {
      Capacitor?: { Plugins?: { App?: { openUrl?: (o: { url: string }) => Promise<unknown> } } };
    };
    await anyWindow.Capacitor?.Plugins?.App?.openUrl?.({ url });
    return true;
  } catch {
    return false;
  }
}
