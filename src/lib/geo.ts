import { useEffect, useRef, useState } from "react";

export interface Coords {
  lat: number;
  lng: number;
}

export type LocationState =
  | { status: "loading" }
  | { status: "granted"; coords: Coords }
  | { status: "denied" }
  | { status: "unavailable" };

/**
 * Reliable location hook.
 * - Uses navigator.geolocation.getCurrentPosition directly (avoids the
 *   inconsistent navigator.permissions.query, which is broken on Safari).
 * - Only reports "denied" when the browser actually returns PERMISSION_DENIED.
 * - Auto-retries every 3s while not granted, so the moment the user allows
 *   location in the browser prompt / OS settings, the app resumes on its own.
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
      });
    };

    const onError = (err: GeolocationPositionError) => {
      // Only treat explicit user denial as "denied". Timeouts / temporary
      // unavailability should keep the UI in a loading state and retry.
      setState((prev) => {
        if (err.code === err.PERMISSION_DENIED) return { status: "denied" };
        if (prev.status === "granted") return prev; // don't downgrade a good fix
        return { status: "loading" };
      });
    };

    const opts: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
    };

    // Kick off an immediate one-shot read so we don't wait for a watch tick.
    navigator.geolocation.getCurrentPosition(onSuccess, onError, opts);

    if (watch) {
      try {
        watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, opts);
      } catch {
        // ignore — polling below will cover it
      }
    }

    // Auto-recovery poll: if the user grants permission later, we'll pick it up.
    pollRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, {
        ...opts,
        maximumAge: 0,
      });
    }, 3000);

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [watch]);

  return state;
}

export function getPositionOnce(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return reject(new Error("Geolocation unavailable"));
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}
