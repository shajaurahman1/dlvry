// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

// The SPA shell prerender boots a preview server that imports `dist/server/<input>.js`,
// but the nitro build emits `dist/server/index.mjs`. Emit a tiny re-export shim so the
// prerender step can load the built server instead of failing with
// "Failed to fetch /: Internal Server Error".
function prerenderServerEntryShim(): Plugin {
  return {
    name: "dlvry:prerender-server-entry-shim",
    apply: "build",
    enforce: "post",
    writeBundle() {
      const dir = resolve(process.cwd(), "dist/server");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        resolve(dir, "server.js"),
        "export { default } from './index.mjs';\nexport * from './index.mjs';\n",
      );
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // SPA shell prerender: emits a static dist/client/index.html that boots the client
    // router. Required for Capacitor, which ships static web assets with no server.
    spa: {
      enabled: true,
      prerender: { crawlLinks: false, outputPath: "/index.html" },
    },
  },
  vite: {
    plugins: [prerenderServerEntryShim()],
  },
});
