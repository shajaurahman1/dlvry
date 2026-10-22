import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.moveby.app",
  appName: "MOVEBY",
  webDir: ".output/public",
  // Every data call the app makes goes cross-origin (the Capacitor WebView's
  // own local origin -> https://moveby.in), and the WebView's own fetch/XHR
  // engine has proven unreliable for that on at least one real device even
  // after fixing every CORS detail server-side could control (origin match,
  // preflight headers) — it's possible that device's WebView component is
  // simply too old/non-standard to trust for this. CapacitorHttp routes
  // window.fetch/XMLHttpRequest through native Android networking instead,
  // which isn't subject to the WebView's CORS enforcement or its TLS/cert
  // handling at all.
  plugins: {
    CapacitorHttp: { enabled: true },
  },
};

export default config;
