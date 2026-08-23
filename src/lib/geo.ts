import { useCallback, useEffect, useRef, useState } from "react";

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

export type LocationStatus =
  | "loading" // first attempt in flight, no fix yet
  | "searching" // taking a while but permission ok — keep trying
  | "granted" // have a live fix
  | "denied" // user blocked permission
  | "unavailable"; // no GPS / no geolocation API

export type LocationState =
  | { status: "loading"; retry: () => void }
  | { status: "searching"; retry: () => void }
  | { status: "granted"; coords: Coords; accuracy: number; retry: () => void }
  | { status: "denied"; retry: () => void }
  | { status: "unavailable"; retry: () => void };

/** Best-effort browser permission read. Safari lacks Permissions API for geo. */
export async function readGeoPermission(): Promise<PermissionState> {
  try {
    if (typeof navigator === "undefined" || !("permissions" in navigator)) return "unknown";
    const res = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return (res.state as PermissionState) ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Uber-style live location hook.
 * - Only surfaces `denied` when the browser explicitly returns PERMISSION_DENIED.
 * - Never gets stuck in "loading" — after a short wait we move to "searching"
 *   which still renders a spinner but with a working Retry button.
 * - Once we have any fix, we stay in "granted" and keep the last-known coords
 *   even if the next poll transiently fails (mirrors real map apps).
 * - Listens to `permissions.onchange` so mid-session grants are picked up.
 */
export function useLiveLocation(watch = true): LocationState {
  const [status, setStatus] = useState<LocationStatus>("loading");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [accuracy, setAccuracy] = useState<number>(0);
  const [tick, setTick] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gotFixRef = useRef(false);

  const retry = useCallback(() => {
    gotFixRef.current = false;
    setStatus("loading");
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }

    let cancelled = false;

    const onSuccess = (pos: GeolocationPosition) => {
      if (cancelled) return;
      gotFixRef.current = true;
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setAccuracy(pos.coords.accuracy);
      setStatus("granted");
    };

    const onError = (err: GeolocationPositionError) => {
      if (cancelled) return;
      if (err.code === err.PERMISSION_DENIED) {
        setStatus("denied");
        return;
      }
      // POSITION_UNAVAILABLE / TIMEOUT — keep trying, don't block the app
      if (!gotFixRef.current) {
        setStatus((prev) => (prev === "loading" ? "searching" : prev));
      }
    };

    // Fast + coarse first fix, then upgrade to high accuracy in the watcher.
    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 60000,
    });

    if (watch) {
      try {
        watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 5000,
        });
      } catch {
        /* ignore */
      }
    }

    // Background poll — recovers from transient failures without user action.
    pollRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      });
    }, 5000);

    // If we still don't have a fix after 5s, flip to "searching" so the UI
    // can offer a retry button instead of an endless spinner.
    searchTimerRef.current = setTimeout(() => {
      if (!gotFixRef.current && !cancelled) {
        setStatus((prev) => (prev === "loading" ? "searching" : prev));
      }
    }, 5000);

    // React to permission changes mid-session (user toggles allow in browser).
    let permObj: PermissionStatus | null = null;
    const onPermChange = () => {
      if (!permObj) return;
      if (permObj.state === "granted") retry();
      else if (permObj.state === "denied") setStatus("denied");
    };
    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((p) => {
          permObj = p;
          p.addEventListener("change", onPermChange);
        })
        .catch(() => {
          /* ignore */
        });
    }

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (permObj) permObj.removeEventListener("change", onPermChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch, tick]);

  if (status === "granted" && coords) return { status, coords, accuracy, retry };
  if (status === "granted") return { status: "loading", retry };
  return { status, retry } as LocationState;
}

export function getPositionOnce(): Promise<FixResult> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return reject(new Error("Geolocation is not supported by this browser"));
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => {
        const messages: Record<number, string> = {
          1: "Location permission denied. Please allow location in your browser settings.",
          2: "Location unavailable. Please check GPS / network and try again.",
          3: "Location request timed out. Please try again.",
        };
        const err = new Error(
          messages[e.code] ?? e.message ?? "Failed to get location",
        ) as Error & { code?: number };
        err.code = e.code;
        reject(err);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}
