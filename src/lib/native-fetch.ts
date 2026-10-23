import { isNativeApp } from "@/lib/platform";

/**
 * Routes a fetch call through Capacitor's native HTTP plugin (real OkHttp,
 * on Android) instead of the WebView's own fetch — no CORS, no preflight,
 * no WebView networking involved at all. Used for any cross-origin call
 * made from inside the native app: our own server functions (moveby.in)
 * and Supabase auth (a different domain entirely, *.lovable.cloud), both
 * of which have shown the same "the WebView's fetch just doesn't complete
 * this request" failure mode on at least one real device.
 *
 * Falls back to the ordinary global `fetch` outside the native app (web)
 * and if anything about this call isn't native-HTTP-shaped (e.g. non-string
 * URL), so this is always safe to wrap around any fetch call site.
 */
export async function nativeAwareFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!isNativeApp() || typeof input !== "string" || !input.startsWith("http")) {
    return fetch(input, init);
  }
  const { CapacitorHttp } = await import("@capacitor/core");
  const headers: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, key) => {
    headers[key] = value;
  });
  const res = await CapacitorHttp.request({
    url: input,
    method: (init?.method ?? "GET").toUpperCase(),
    headers,
    data: typeof init?.body === "string" ? init.body : undefined,
  });
  const resHeaders = new Headers();
  for (const [key, value] of Object.entries(res.headers ?? {})) {
    if (typeof value === "string") resHeaders.set(key, value);
  }
  const body = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
  return new Response(body, { status: res.status, headers: resHeaders });
}
