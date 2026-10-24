import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enableNotifications, notificationStatus } from "@/lib/push";

const DISMISS_KEY = "moveby_notif_prompt_dismissed";

/** Soft in-app ask shown before the OS permission dialog, like most delivery
 *  apps do — people are far more likely to allow it when they understand why
 *  first, instead of getting a bare system prompt on first launch. */
export function NotificationPromptCard() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch { /* ignore */ }
    if (dismissed) return;
    void notificationStatus().then((status) => setShow(status === "prompt"));
  }, []);

  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  };

  if (!show) return null;
  return (
    <div className="mb-6 flex items-start gap-3 card-soft border-primary/20 bg-primary/5 p-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
        <Bell className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Turn on notifications</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Get notified the moment a new order or update comes in, even when the app is closed.
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            className="rounded-full"
            onClick={async () => {
              setBusy(true);
              try {
                const status = await enableNotifications();
                if (status !== "prompt") dismiss();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Enabling…" : "Enable"}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={dismiss}>
            Not now
          </Button>
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
