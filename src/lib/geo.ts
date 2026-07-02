import { useEffect, useState } from "react";

export interface Coords {
  lat: number;
  lng: number;
}

export type LocationState =
  | { status: "loading" }
  | { status: "granted"; coords: Coords }
  | { status: "denied" }
  | { status: "unavailable" };

export function useLiveLocation(watch = true): LocationState {
  const [state, setState] = useState<LocationState>({ status: "loading" });

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "unavailable" });
      return;
    }
    const onSuccess = (pos: GeolocationPosition) =>
      setState({ status: "granted", coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
    const onError = (err: GeolocationPositionError) =>
      setState({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" });

    if (watch) {
      const id = navigator.geolocation.watchPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        maximumAge: 15000,
        timeout: 20000,
      });
      return () => navigator.geolocation.clearWatch(id);
    }
    navigator.geolocation.getCurrentPosition(onSuccess, onError, { enableHighAccuracy: true });
  }, [watch]);

  return state;
}

export function getPositionOnce(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation unavailable"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}
