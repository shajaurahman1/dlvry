import { useCallback, useEffect, useRef, useState } from "react";
import { isNativeApp } from "@/lib/platform";

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

/** Explicit state machine — never an endless spinner. */
export type LocationStatus =
  | "loading" // first attempt in flight
  | "searching" // taking a while, still trying
  | "granted" // we have a usable fix (possibly a recent cached one)
  | "denied" // permission denied (retry or open settings)
  | "gps_disabled" // device location services are off
  | "unavailable"; // no geolocation capability at all

export interface LocationState {
  status: LocationStatus;
  coords?: Coords;
  accuracy?: number;
  /** epoch ms of the fix we're showing */
  updatedAt?: number;
  /** true when the fix comes from cache and we're still refreshing */
  stale?: boolean;
  retry: () => void;
}

const CACHE_KEY = "dlvry:last-location";
const CACHE_MAX_AGE = 15 * 60 * 1000; // 15 min — good enough to unblock the UI
const FIRST_FIX_TIMEOUT = 12_000;

interface CachedFix {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
}

export function readCachedLocation(): CachedFix | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedFix;
    if (typeof parsed?.lat !== "number" || typeof parsed?.lng !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedLocation(fix: CachedFix) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(fix));
  } catch {
    /* ignore quota / private mode */
  }
}

export function locationAgeLabel(at?: number): string {
  if (!at) return "";
  const secs = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} h ago`;
}

/** Best-effort permission read (native first, then Permissions API). */
export async function readGeoPermission(): Promise<PermissionState> {
  try {
    if (isNativeApp()) {
      const { Geolocation } = await import("@capacitor/geolocation");
      const st = await Geolocation.checkPermissions();
      const v = st.location ?? st.coarseLocation;
      if (v === "granted") return "granted";
      if (v === "denied") return "denied";
      return "prompt";
    }
    if (typeof navigator === "undefined" || !("permissions" in navigator)) return "unknown";
    const res = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return (res.state as PermissionState) ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Ask for permission the native way on Android; no-op on web (prompt is implicit). */
export async function ensureLocationPermission(): Promise<PermissionState> {
  if (!isNativeApp()) return readGeoPermission();
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    let st = await Geolocation.checkPermissions();
    if ((st.location ?? st.coarseLocation) !== "granted") {
      st = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
    }
    const v = st.location ?? st.coarseLocation;
    return v === "granted" ? "granted" : v === "denied" ? "denied" : "prompt";
  } catch {
    return "unknown";
  }
}

export class LocationError extends Error {
  kind: "denied" | "gps_disabled" | "timeout" | "unavailable";
  constructor(kind: LocationError["kind"], message: string) {
    super(message);
    this.kind = kind;
  }
}

interface FixOptions {
  highAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

/** One-shot fix that works identically on Android (Capacitor) and the web. */
export async function getPositionOnce(opts: FixOptions = {}): Promise<FixResult> {
  const { highAccuracy = true, timeout = FIRST_FIX_TIMEOUT, maximumAge = 0 } = opts;

  if (isNativeApp()) {
    const perm = await ensureLocationPermission();
    if (perm === "denied") {
      throw new LocationError("denied", "Location permission is required to continue.");
    }
    const { Geolocation } = await import("@capacitor/geolocation");
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: highAccuracy,
        timeout,
        maximumAge,
      });
      const fix = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? 0,
      };
      writeCachedLocation({ ...fix, at: Date.now() });
      return fix;
    } catch (e) {
      const msg = (e as Error)?.message?.toLowerCase() ?? "";
      if (msg.includes("denied") || msg.includes("permission")) {
        throw new LocationError("denied", "Location permission is required to continue.");
      }
      if (msg.includes("disabled") || msg.includes("location services")) {
        throw new LocationError("gps_disabled", "Turn on Location Services to continue.");
      }
      if (msg.includes("time")) {
        throw new LocationError(
          "timeout",
          "Couldn't get a GPS fix. Move to an open area and retry.",
        );
      }
      throw new LocationError("unavailable", "Location unavailable right now.");
    }
  }

  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return reject(new LocationError("unavailable", "Location is not supported on this device."));
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const fix = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        };
        writeCachedLocation({ ...fix, at: Date.now() });
        resolve(fix);
      },
      (e) => {
        if (e.code === 1) {
          reject(new LocationError("denied", "Location permission is required to continue."));
        } else if (e.code === 3) {
          reject(new LocationError("timeout", "Location request timed out. Please try again."));
        } else {
          reject(new LocationError("unavailable", "Location unavailable. Check GPS and retry."));
        }
      },
      { enableHighAccuracy: highAccuracy, timeout, maximumAge },
    );
  });
}

/**
 * Live location with a deterministic state machine:
 * loading -> (searching) -> granted | denied | gps_disabled | unavailable.
 * A recent cached fix immediately unblocks the UI (flagged `stale`) while a
 * fresh fix is fetched in the background.
 */
export function useLiveLocation(watch = true): LocationState {
  const [status, setStatus] = useState<LocationStatus>("loading");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [accuracy, setAccuracy] = useState<number>(0);
  const [updatedAt, setUpdatedAt] = useState<number | undefined>(undefined);
  const [stale, setStale] = useState(false);
  const [tick, setTick] = useState(0);
  const gotFixRef = useRef(false);

  const retry = useCallback(() => {
    gotFixRef.current = false;
    setStatus("loading");
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let clearWatch: (() => void) | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    let searchTimer: ReturnType<typeof setTimeout> | undefined;

    const accept = (fix: FixResult, fromCache = false) => {
      if (cancelled) return;
      gotFixRef.current = true;
      setCoords({ lat: fix.lat, lng: fix.lng });
      setAccuracy(fix.accuracy);
      setUpdatedAt(Date.now());
      setStale(fromCache);
      setStatus("granted");
    };

    const fail = (e: unknown) => {
      if (cancelled) return;
      const kind = e instanceof LocationError ? e.kind : "unavailable";
      if (kind === "denied") {
        setStatus("denied");
        return;
      }
      if (kind === "gps_disabled") {
        setStatus("gps_disabled");
        return;
      }
      // timeout / transient: keep the cached fix if we have one
      if (!gotFixRef.current) setStatus((p) => (p === "loading" ? "searching" : p));
    };

    // 1. Unblock instantly from a recent cached fix.
    const cached = readCachedLocation();
    if (cached && Date.now() - cached.at < CACHE_MAX_AGE) {
      setCoords({ lat: cached.lat, lng: cached.lng });
      setAccuracy(cached.accuracy);
      setUpdatedAt(cached.at);
      setStale(true);
      setStatus("granted");
    }

    // 2. Fast coarse fix, then high accuracy.
    void getPositionOnce({ highAccuracy: false, timeout: 8000, maximumAge: 60_000 })
      .then((f) => accept(f))
      .catch(fail);

    void getPositionOnce({ highAccuracy: true, timeout: FIRST_FIX_TIMEOUT, maximumAge: 0 })
      .then((f) => accept(f))
      .catch(fail);

    // 3. Continuous watch.
    if (watch) {
      if (isNativeApp()) {
        let watchId: string | undefined;
        void (async () => {
          try {
            const { Geolocation } = await import("@capacitor/geolocation");
            watchId = await Geolocation.watchPosition(
              { enableHighAccuracy: true, timeout: 20_000, maximumAge: 5000 },
              (pos, err) => {
                if (err || !pos) return;
                const fix = {
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  accuracy: pos.coords.accuracy ?? 0,
                };
                writeCachedLocation({ ...fix, at: Date.now() });
                accept(fix);
              },
            );
          } catch {
            /* ignore */
          }
        })();
        clearWatch = () => {
          if (!watchId) return;
          void import("@capacitor/geolocation").then(({ Geolocation }) =>
            Geolocation.clearWatch({ id: watchId! }).catch(() => undefined),
          );
        };
      } else if (typeof navigator !== "undefined" && navigator.geolocation) {
        const id = navigator.geolocation.watchPosition(
          (p) => {
            const fix = {
              lat: p.coords.latitude,
              lng: p.coords.longitude,
              accuracy: p.coords.accuracy,
            };
            writeCachedLocation({ ...fix, at: Date.now() });
            accept(fix);
          },
          (e) => fail(new LocationError(e.code === 1 ? "denied" : "unavailable", e.message)),
          { enableHighAccuracy: true, timeout: 20_000, maximumAge: 5000 },
        );
        clearWatch = () => navigator.geolocation.clearWatch(id);
      }
    }

    // 4. Background refresh so transient failures self-heal.
    poll = setInterval(() => {
      void getPositionOnce({ highAccuracy: true, timeout: 15_000, maximumAge: 10_000 })
        .then((f) => accept(f))
        .catch(() => undefined);
    }, 15_000);

    // 5. Hard stop on the spinner.
    searchTimer = setTimeout(() => {
      if (!gotFixRef.current && !cancelled) {
        setStatus((p) => (p === "loading" ? "searching" : p));
      }
    }, 6000);

    return () => {
      cancelled = true;
      clearWatch?.();
      if (poll) clearInterval(poll);
      if (searchTimer) clearTimeout(searchTimer);
    };
  }, [watch, tick]);

  if (status === "granted" && coords) {
    return { status, coords, accuracy, updatedAt, stale, retry };
  }
  if (status === "granted") return { status: "loading", retry };
  return { status, retry };
}
