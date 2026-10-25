import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isNativeApp } from "@/lib/platform";
import { getAppVersionInfo } from "@/lib/misc.functions";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.movebyapp.android";

/** Self-hosted update check, not Play Store's in-app-update API — the
 *  installed build's own versionCode vs. an admin-set "latest" number in
 *  app_settings. Works the same on Internal Testing as it would in
 *  production, since it never depends on Play Store knowing what's
 *  "current" for this tester's track. */
export function UpdateChecker() {
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        const installed = Number(info.build);
        const latest = await getAppVersionInfo();
        if (Number.isFinite(installed) && latest.latest_version_code > installed) {
          setMessage(latest.update_message?.trim() || "A new version of MOVEBY is available.");
        }
      } catch {
        /* never block app usage over a failed version check */
      }
    })();
  }, []);

  if (!message || dismissed) return null;
  return (
    <div
      className="fixed inset-x-0 top-0 z-[90] flex items-center gap-3 border-b border-border bg-card px-4 py-3 shadow-elevated"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <Download className="h-4 w-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-xs font-medium">{message}</p>
      <Button
        size="sm"
        className="h-8 shrink-0 rounded-full px-3 text-xs"
        onClick={() => window.open(PLAY_STORE_URL, "_blank")}
      >
        Update
      </Button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="shrink-0 text-muted-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
