import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { switchDashboard } from "@/lib/account.functions";
import { NotificationSettings } from "@/components/notification-settings";

export function AccountSettings({ currentRole }: { currentRole: "shopkeeper" | "driver" }) {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const switchRole = useServerFn(switchDashboard);
  const target = currentRole === "shopkeeper" ? "driver" : "shopkeeper";
  return (
    <section className="mb-8 space-y-5 border-b border-border pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Account role</h2>
          <p className="text-sm text-muted-foreground">
            {currentRole === "driver" ? "Delivery partner" : "Shopkeeper"}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await switchRole({ data: { role: target } });
              if (result.needsSetup) {
                await navigate({ to: "/onboarding", search: { role: target } });
              } else {
                await refresh();
                await navigate({ to: target === "driver" ? "/driver" : "/shop" });
                toast.success(
                  `Switched to ${target === "driver" ? "delivery partner" : "shopkeeper"}`,
                );
              }
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Couldn't switch roles");
            } finally {
              setBusy(false);
            }
          }}
        >
          <ArrowLeftRight className="h-4 w-4" />
          {busy
            ? "Switching…"
            : `Switch to ${target === "driver" ? "delivery partner" : "shopkeeper"}`}
        </Button>
      </div>
      <NotificationSettings />
    </section>
  );
}
