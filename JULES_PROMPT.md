# Prompt for Jules AI — build DLVRY Android APK + AAB

Copy everything below into Jules and point it at the DLVRY GitHub repository.

---

You are working on the GitHub repository for **DLVRY**, a TanStack Start (React 19 + Vite 7)
web app wrapped with **Capacitor** for Android.

**Goal:** pull the latest `main`, verify the newest edits build, and produce a working
**debug APK** and a **release AAB** as downloadable artifacts.

### Environment
- Node.js 20, Java 21 (Temurin), Android SDK with `compileSdk 36`, `minSdk 24`.

### Steps
1. Checkout the latest `main` branch.
2. `npm ci`
3. `npm run build` — this must complete with exit code 0 and emit static assets into
   `dist/client/`, including `dist/client/index.html`.
   - If the build fails with `Cannot find module '.../dist/server/server.js'`, the Vite plugin
     `prerenderServerEntryShim` in `vite.config.ts` is responsible for emitting that shim.
     Fix it there — do not delete the SPA prerender config in `vite.config.ts`.
   - Do not change `webDir` in `capacitor.config.ts`; it must stay `dist/client`.
4. `npx cap sync android`
5. Build the debug APK:
   `cd android && ./gradlew assembleDebug`
   Output: `android/app/build/outputs/apk/debug/app-debug.apk`
6. Build the release bundle:
   `cd android && ./gradlew bundleRelease`
   Output: `android/app/build/outputs/bundle/release/app-release.aab`
   (unsigned is acceptable; if signing keys are provided as secrets, sign it)
7. Upload both files as build artifacts and report their sizes plus the app version
   (`versionCode` / `versionName` in `android/app/build.gradle`).

### Verification checklist before finishing
- `AndroidManifest.xml` declares `INTERNET`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`.
- Capacitor plugins `@capacitor/app`, `@capacitor/geolocation`, `@capacitor/status-bar`
  appear in `android/app/capacitor.build.gradle` after sync.
- No TypeScript errors: `npx tsc --noEmit`.
- Report any file you had to change and open a PR with those changes.
