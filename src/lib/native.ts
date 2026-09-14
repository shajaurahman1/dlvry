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
        const handle = await App.addListener("backButton", ({ canGoBack }) => {
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
        remove = () => {
          handle.remove();
          urlHandle.remove();
        };

        const handleUrl = async (urlStr: string) => {
          if (
            urlStr.includes("callback") ||
            urlStr.includes("type=recovery") ||
            urlStr.includes("dlvry.lovable.app")
          ) {
            try {
              const { Browser } = await import("@capacitor/browser");
              await Browser.close().catch(() => {});
            } catch {
              // ignore
            }
            const url = new URL(urlStr);

            // If it's a direct deep link to the lovable app domain, it's likely a recovery link
            // Adjust the URL so the router correctly processes the hash/search parameters
            const isRecovery = urlStr.includes("type=recovery");

            router.navigate({
              to: "/auth-callback",
              hash: url.hash.replace(/^#/, ""),
              search: {
                ...Object.fromEntries(url.searchParams.entries()),
                ...(isRecovery ? { type: "recovery" } : {}),
              } as Record<string, unknown>,
            });
          }
        };

        const urlHandle = await App.addListener("appUrlOpen", async (event) => {
          await handleUrl(event.url);
        });

        // Handle cold start url
        const launchUrl = await App.getLaunchUrl();
        if (launchUrl?.url) {
          await handleUrl(launchUrl.url);
        }
      } catch {
        /* app plugin unavailable */
      }
    })();

    return () => remove?.();
  }, [router]);
}
