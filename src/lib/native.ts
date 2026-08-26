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
        remove = () => void handle.remove();
      } catch {
        /* app plugin unavailable */
      }
    })();

    return () => remove?.();
  }, [router]);
}
