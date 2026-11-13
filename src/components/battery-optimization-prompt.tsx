import { useEffect, useState } from "react";
import { BatteryCharging, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isNativeApp, platformName, openBatteryOptimizationSettings } from "@/lib/platform";

const DISMISS_KEY = "moveby_battery_prompt_dismissed";

/** Staying "online" is a toggle in our own database — nothing resets it in
 *  the background. What actually breaks it is some phones' own battery
 *  managers (Xiaomi/Vivo/Oppo especially) freezing or killing the app, which
 *  stops location updates and can delay the push for a new order. This is
 *  a one-time nudge to exempt the app from that, same pattern as the
 *  notification prompt. */
export function BatteryOptimizationPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (dismissed) return;
    if (isNativeApp() && platformName() === "android") setShow(true);
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  if (!show) return null;
  return (
    <div className="mb-6 flex items-start gap-3 card-soft border-primary/20 bg-primary/5 p-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
        <BatteryCharging className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Stay online reliably</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Some phones switch the app off in the background to save battery, which can delay new
          orders reaching you. Turn off battery optimization for MOVEBY to avoid that.
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            size="sm"
            className="rounded-full"
            onClick={async () => {
              await openBatteryOptimizationSettings();
              dismiss();
            }}
          >
            Open settings
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="rounded-full"
            onClick={dismiss}
          >
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
