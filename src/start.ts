import { createStart, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { isNativeApp } from "@/lib/platform";
import { nativeAwareFetch } from "@/lib/native-fetch";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Android WebView serves the app from its own local origin (normally
// https://localhost with Capacitor's default androidScheme/hostname, but
// some WebView builds report other values — e.g. a literal "null" origin
// for sandboxed contexts), a different origin than the deployed server the
// native app now calls into for every server function (see serverFnFetch
// below). The browser enforces CORS on that cross-origin call, so the server
// has to explicitly allow it — otherwise every data call in the Android app
// fails silently at the network layer despite the URL being correct, and
// with zero trace server-side since the browser never lets the real request
// through. Matching against a fixed allowlist of exact origin strings is
// fragile against WebView version/config differences we can't control from
// here, so instead: echo back whatever Origin is sent, for *any* origin.
// This isn't a weaker security boundary than a fixed list — every server
// function already requires a valid Supabase bearer token regardless of
// origin, and nothing here relies on cookies, so there's no CSRF exposure
// from a permissive Origin echo.
const corsMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getRequest();
  const origin = request?.headers.get("origin");
  const allowOrigin = origin || null;

  if (request?.method === "OPTIONS" && allowOrigin) {
    // Echo back whatever headers this exact preflight asked for, instead of
    // a fixed list. Android's WebView silently injects an X-Requested-With
    // header (the app's package name) into every request it makes — not
    // something a desktop/mobile browser does — and a fixed allowlist that
    // doesn't include it makes the browser block the real request right
    // after a successful-looking 204 preflight, with nothing visible
    // anywhere: not a client error, not a server log, since the browser
    // never sends the real request at all.
    const requestedHeaders = request.headers.get("access-control-request-headers");
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":
          requestedHeaders || "authorization, content-type, x-tsr-serverFn, accept",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const result = await next();
  const headers = new Headers(result.response.headers);
  // Every server-fn response reflects live DB state (e.g. getMe()'s roles
  // right after a role was just granted) and must never be cached — this
  // matters more now that native requests go through CapacitorHttp/OkHttp
  // (see serverFnFetch below), which has its own HTTP cache distinct from
  // the WebView's, and was serving a stale pre-role-grant response back
  // on the refetch straight after a successful onboarding submit, bouncing
  // the user back to the role picker.
  headers.set("Cache-Control", "no-store");
  if (allowOrigin) {
    headers.set("Access-Control-Allow-Origin", allowOrigin);
    headers.append("Vary", "Origin");
  }
  return {
    ...result,
    response: new Response(result.response.body, { status: result.response.status, headers }),
  };
});

// The server functions used throughout the app (Turso-backed data calls,
// account.functions.ts, etc.) compile to RPC calls against a *relative*
// path (e.g. /_serverFn/...). That's correct for the Vercel web deploy,
// where the client and server share an origin — but the Android build ships
// a static Capacitor bundle with no server behind it at all, so a relative
// path resolves against the device's local asset origin and 404s. Inside
// the native shell, rewrite every server-fn call to the deployed web
// origin instead, which does have the server running.
//
// Must be the www. form: moveby.in (bare apex) 308-redirects to
// www.moveby.in, and OkHttp/CapacitorHttp drops the Authorization header
// across that redirect — every native POST was reaching the server with no
// auth header at all despite the client attaching one correctly. Pointing
// at the non-redirecting host avoids the redirect, and the header loss,
// entirely.
const PUBLIC_WEB_ORIGIN =
  (import.meta.env.VITE_PUBLIC_WEB_ORIGIN as string | undefined) || "https://www.moveby.in";

const serverFnFetch: typeof fetch = async (input, init) => {
  const isNative = isNativeApp() && typeof input === "string" && input.startsWith("/");
  let target = isNative ? `${PUBLIC_WEB_ORIGIN}${input}` : (input as string | Request | URL);
  if (isNative && typeof target === "string") {
    // Belt and suspenders alongside Cache-Control: no-store on the response
    // (whichever layer is actually caching, a unique URL defeats it either
    // way).
    target += (target.includes("?") ? "&" : "?") + "_t=" + Date.now();
  }
  try {
    return await nativeAwareFetch(target, { ...init, cache: "no-store" });
  } catch (err) {
    // A bare "Failed to fetch" tells us nothing about *why* — it's the
    // generic browser TypeError for any request that never got a response
    // (bad URL, dropped connection, blocked by something on-device). Attach
    // the exact URL that was attempted so the next report is actionable
    // instead of another guess.
    const url =
      typeof target === "string"
        ? target
        : target instanceof URL
          ? target.href
          : (target as Request)?.url ?? "unknown URL";
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Couldn't reach ${url} (${reason})`);
  }
};

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [corsMiddleware, errorMiddleware],
  serverFns: { fetch: serverFnFetch },
}));
