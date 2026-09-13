import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { isNativeApp } from "@/lib/platform";

const ROOT_PATHS = ["/", "/auth", "/shop", "/driver", "/admin"];

/**
 * Native Android shell behaviour:
 * - hardware Back navigates within the app history
 * - on a root screen, Back requires a double press to exit
 * - status bar styled to match the app background
 */
export function useNativeShell() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    let lastBackPress = 0;

    void (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: "#F7F4ED" }).catch(() => undefined);
      } catch {
        /* status bar plugin unavailable */
      }

      try {
        const { App } = await import("@capacitor/app");
        let lastHandledUrl = "";
        const handleUrl = async (rawUrl: string) => {
          if (rawUrl === lastHandledUrl) return;
          lastHandledUrl = rawUrl;

          let url: URL;
          try {
            url = new URL(rawUrl);
          } catch {
            return;
          }

          const hash = url.hash.replace(/^#/, "");
          const hashParams = new URLSearchParams(hash);
          const isRecovery =
            url.searchParams.get("type") === "recovery" || hashParams.get("type") === "recovery";
          if (url.host !== "callback" && url.hostname !== "dlvry.lovable.app" && !isRecovery) {
            return;
          }

          try {
            const { Browser } = await import("@capacitor/browser");
            await Browser.close().catch(() => {});
          } catch {
            // ignore
          }

          const search = Object.fromEntries(url.searchParams.entries());
          if (isRecovery) search.type = "recovery";
          await router.navigate({
            to: "/auth-callback",
            hash,
            search: search as Record<string, unknown>,
          });
        };

        const backHandle = await App.addListener("backButton", ({ canGoBack }) => {
          const path = router.state.location.pathname;
          const atRoot = ROOT_PATHS.includes(path);

          if (!atRoot && canGoBack && window.history.length > 1) {
            router.history.back();
            return;
          }

          const now = Date.now();
          if (now - lastBackPress < 2000) {
            void App.exitApp();
          } else {
            lastBackPress = now;
            toast("Press back again to exit");
          }
        });

        const urlHandle = await App.addListener("appUrlOpen", (event) => {
          void handleUrl(event.url);
        });

        remove = () => {
          void backHandle.remove();
          void urlHandle.remove();
        };

        // appUrlOpen is not guaranteed to fire when Android starts a cold app.
        const launch = await App.getLaunchUrl();
        if (launch?.url) void handleUrl(launch.url);
      } catch {
        /* app plugin unavailable */
      }
    })();

    return () => remove?.();
  }, [router]);
}
