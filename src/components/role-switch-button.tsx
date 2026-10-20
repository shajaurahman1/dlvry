import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { switchDashboard } from "@/lib/account.functions";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils";

const LABEL: Record<"shopkeeper" | "driver", string> = {
  shopkeeper: "Switch to Shopkeeper",
  driver: "Switch to Delivery Partner",
};

const DASHBOARD: Record<"shopkeeper" | "driver", string> = {
  shopkeeper: "/shop",
  driver: "/driver",
};

/**
 * Lets a user who holds both roles move between the Shopkeeper and Delivery
 * Partner dashboards on one account, without signing out. If they don't hold
 * the target role yet, this sends them to onboarding for it instead of
 * switching — switching never grants a role or bypasses setup/approval.
 */
export function RoleSwitchButton({ targetRole }: { targetRole: "shopkeeper" | "driver" }) {
  const { roles, refresh } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const hasTarget = roles.includes(targetRole);

  const onClick = async () => {
    if (!hasTarget) {
      navigate({ to: "/onboarding", search: { role: targetRole } });
      return;
    }
    setBusy(true);
    try {
      const result = await switchDashboard({ data: { role: targetRole } });
      if (result.needsSetup) {
        navigate({ to: "/onboarding", search: { role: targetRole } });
        return;
      }
      await refresh();
      navigate({ to: DASHBOARD[targetRole] });
      toast.success(`Switched to ${targetRole === "driver" ? "delivery partner" : "shopkeeper"}`);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't switch dashboards."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      disabled={busy}
      onClick={onClick}
      className="h-11 rounded-full px-4 text-xs font-semibold sm:text-sm"
    >
      <ArrowLeftRight className="mr-1.5 h-4 w-4" />
      {hasTarget ? LABEL[targetRole] : `Set up ${targetRole === "shopkeeper" ? "Shop" : "Delivery"} profile`}
    </Button>
  );
}
