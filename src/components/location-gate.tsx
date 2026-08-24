import { MapPin, Settings, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/back-button";
import { isNativeApp, openAppSettings } from "@/lib/platform";
import type { LocationStatus } from "@/lib/geo";
import { ensureLocationPermission } from "@/lib/geo";

/**
 * Platform-aware location gate. Inside the Android app we never reference the
 * browser, address bar or site permissions — only native wording and actions.
 */
export function LocationGate({
  state,
  onRetry,
  allowBack = true,
}: {
  state: LocationStatus;
  onRetry: () => void;
  allowBack?: boolean;
}) {
  const native = isNativeApp();
  const isBusy = state === "loading" || state === "searching";

  const title =
    state === "loading"
      ? "Finding your location…"
      : state === "searching"
        ? "Still looking for GPS"
        : state === "denied"
          ? "Location access is off"
          : state === "gps_disabled"
            ? "Turn on Location Services"
            : "Location unavailable";

  const body =
    state === "loading"
      ? native
        ? "Location permission is required to find nearby delivery requests."
        : "Allow the location prompt when it appears."
      : state === "searching"
        ? "Taking longer than usual. Move to an open area — we'll keep trying in the background."
        : state === "denied"
          ? native
            ? "DLVRY needs location access to show delivery requests within 3 km of you."
            : "Location is blocked for this site. Re-enable it in your site settings, then try again."
          : state === "gps_disabled"
            ? "Location Services are switched off on this device. Turn them on to continue."
            : "We can't read a location right now. Check that GPS is on and try again.";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background px-6 pt-safe">
      {allowBack && (
        <div className="pt-4">
          <BackButton />
        </div>
      )}
      <div className="flex flex-1 items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
            {isBusy ? (
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            ) : (
              <MapPin className="h-7 w-7" />
            )}
          </div>
          <h1 className="mt-6 text-2xl font-black">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{body}</p>

          <div className="mt-6 flex flex-col items-center gap-2.5">
            {native && (state === "denied" || state === "loading") && (
              <Button
                className="w-full max-w-xs rounded-full"
                onClick={async () => {
                  await ensureLocationPermission();
                  onRetry();
                }}
              >
                Allow location
              </Button>
            )}
            <Button
              variant={native && state === "denied" ? "outline" : "default"}
              className="w-full max-w-xs rounded-full"
              onClick={onRetry}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" /> Try again
            </Button>
            {native && (state === "denied" || state === "gps_disabled") && (
              <Button
                variant="outline"
                className="w-full max-w-xs rounded-full"
                onClick={() => void openAppSettings()}
              >
                <Settings className="mr-1.5 h-4 w-4" /> Open settings
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
