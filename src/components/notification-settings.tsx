import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enableNotifications, notificationStatus, type PushStatus } from "@/lib/push";

const labels: Record<PushStatus, string> = {
  unsupported: "Phone notifications are available in the moveby Android app.",
  prompt: "Phone notification permission is not enabled.",
  denied: "Notifications are blocked. Enable them in Android Settings → Apps → moveby → Notifications, then retry.",
  enabled: "Phone notification permission is enabled.",
  error: "Phone registration failed. Check your connection and the app's Firebase setup, then retry.",
};
export function NotificationSettings() {
  const [status, setStatus] = useState<PushStatus>("prompt");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void notificationStatus().then(setStatus);
    const update = () => void notificationStatus().then(setStatus);
    window.addEventListener("focus", update);
    return () => window.removeEventListener("focus", update);
  }, []);
  return <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="max-w-lg">
      <h2 className="text-lg font-semibold">Phone notifications</h2>
      <p role="status" className="text-sm text-muted-foreground">{labels[status]}</p>
    </div>
    {status !== "unsupported" && <Button type="button" disabled={busy} variant="outline" onClick={async () => {
      setBusy(true);
      try { setStatus(await enableNotifications()); } finally { setBusy(false); }
    }}><Bell className="h-4 w-4" />{busy ? "Connecting…" : status === "enabled" ? "Reconnect notifications" : "Enable notifications"}</Button>}
  </div>;
}
