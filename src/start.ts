import { createStart, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { isNativeApp } from "@/lib/platform";

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

// Android WebView serves the app from https://localhost (Capacitor's default
// androidScheme/hostname), a different origin than the deployed server the
// native app now calls into for every server function (see serverFnFetch
// below). The browser enforces CORS on that cross-origin call, so the server
// has to explicitly allow it — otherwise every data call in the Android app
// fails silently at the network layer despite the URL being correct.
const ALLOWED_NATIVE_ORIGINS = new Set(["https://localhost", "capacitor://localhost"]);

const corsMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getRequest();
  const origin = request?.headers.get("origin");
  const allowOrigin = origin && ALLOWED_NATIVE_ORIGINS.has(origin) ? origin : null;

  if (request?.method === "OPTIONS" && allowOrigin) {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type, x-tsr-serverFn, accept",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const result = await next();
  if (!allowOrigin) return result;
  const headers = new Headers(result.response.headers);
  headers.set("Access-Control-Allow-Origin", allowOrigin);
  headers.append("Vary", "Origin");
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
const PUBLIC_WEB_ORIGIN =
  (import.meta.env.VITE_PUBLIC_WEB_ORIGIN as string | undefined) || "https://moveby.in";

const serverFnFetch: typeof fetch = async (input, init) => {
  const target =
    isNativeApp() && typeof input === "string" && input.startsWith("/")
      ? `${PUBLIC_WEB_ORIGIN}${input}`
      : input;
  try {
    return await fetch(target, init);
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
