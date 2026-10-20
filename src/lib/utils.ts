import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * "Failed to fetch" is the raw browser TypeError for a request that never
 * got a response at all (no connectivity, DNS failure, connection dropped
 * mid-flight) — not an app bug, but it reads like one to a non-technical
 * user. Surface it as a plain connectivity message instead everywhere we'd
 * otherwise show err.message in a toast.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    if (/failed to fetch|network ?error|load failed/i.test(err.message)) {
      return "No internet connection. Check your Wi-Fi or mobile data and try again.";
    }
    return err.message;
  }
  return fallback;
}
