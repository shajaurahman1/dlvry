import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.moveby.app",
  appName: "MOVEBY",
  webDir: ".output/public",
  // NOT enabling CapacitorHttp's global window.fetch/XMLHttpRequest patch
  // here (plugins.CapacitorHttp.enabled) on purpose: it intercepts *every*
  // fetch call app-wide, including Supabase's own auth calls — and its
  // patched fetch routes GET/HEAD/OPTIONS through the WebView's own fetch
  // via a local proxy while only POST/PUT/etc. go through the native
  // bridge, an inconsistent split we don't want. Our own server-fn calls
  // (src/start.ts's serverFnFetch) call the CapacitorHttp *plugin* directly
  // instead (CapacitorHttp.request(...)), which bypasses the WebView's
  // fetch/CORS entirely without touching window.fetch or affecting any
  // other code path in the app.
};

export default config;
