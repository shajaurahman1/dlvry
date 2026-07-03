import { useEffect, useRef, useState } from "react";

export interface Coords {
  lat: number;
  lng: number;
}

export interface FixResult {
  lat: number;
  lng: number;
  accuracy: number;
}

export type PermissionState = "granted" | "prompt" | "denied" | "unknown";

export type LocationState =
  | { status: "loading" }
  | { status: "granted"; coords: Coords; accuracy: number }
  | { status: "denied" }
  | { status: "unavailable" };

/** Best-effort browser permission read. Safari lacks Permissions API for geo. */
export async function readGeoPermission(): Promise<PermissionState> {
  try {
    if (typeof navigator === "undefined" || !("permissions" in navigator)) return "unknown";
    // @ts-expect-error Safari types
    const res = await navigator.permissions.query({ name: "geolocation" });
    return (res.state as PermissionState) ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Live location hook.
 * - Uses navigator.geolocation directly (Safari-safe).
 * - Only marks "denied" when the browser explicitly returns PERMISSION_DENIED.
 * - Auto-polls every 3s so grants made mid-session are picked up.
 */
export function useLiveLocation(watch = true): LocationState {
  const [state, setState] = useState<LocationState>({ status: "loading" });
  const watchIdRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "unavailable" });
      return;
    }

    const onSuccess = (pos: GeolocationPosition) => {
      setState({
        status: "granted",
        coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        accuracy: pos.coords.accuracy,
      });
    };

    const onError = (err: GeolocationPositionError) => {
      setState((prev) => {
        if (err.code === err.PERMISSION_DENIED) return { status: "denied" };
        if (prev.status === "granted") return prev;
        return { status: "loading" };
      });
    };

    const opts: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 };

    navigator.geolocation.getCurrentPosition(onSuccess, onError, opts);

    if (watch) {
      try {
        watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, opts);
      } catch { /* ignore */ }
    }

    pollRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, { ...opts, maximumAge: 0 });
    }, 3000);

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [watch]);

  return state;
}

export function getPositionOnce(): Promise<FixResult> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return reject(new Error("Geolocation is not supported by this browser"));
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => {
        const messages: Record<number, string> = {
          1: "Location permission denied. Please allow location in your browser settings.",
          2: "Location unavailable. Please check GPS / network and try again.",
          3: "Location request timed out. Please try again.",
        };
        const err = new Error(messages[e.code] ?? e.message ?? "Failed to get location") as Error & { code?: number };
        err.code = e.code;
        reject(err);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}
