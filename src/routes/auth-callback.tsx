import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isNativeApp } from "@/lib/platform";

export const Route = createFileRoute("/auth-callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const processAuth = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const errorDesc =
        url.searchParams.get("error_description") ||
        url.hash.match(/error_description=([^&]+)/)?.[1];

      if (errorDesc) {
        toast.error(decodeURIComponent(errorDesc));
        navigate({ to: "/auth", replace: true });
        return;
      }

      const type = url.searchParams.get("type");
      const isNative = isNativeApp();

      if (code && isNative) {
        // On native, we must exchange the code manually because the deep link
        // doesn't trigger Supabase's automatic on-load processing
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          toast.error(error.message);
          navigate({ to: "/auth", replace: true });
        } else {
          if (type === "recovery") {
            navigate({ to: "/auth", search: { mode: "reset" }, replace: true });
          } else {
            navigate({ to: "/onboarding", replace: true });
          }
        }
      } else {
        // For web (or implicit flows on native), wait for Supabase to automatically
        // exchange the code or pick up the session from the URL hash.
        // We poll briefly to wait for the session to become available.
        let session = null;
        for (let i = 0; i < 20; i++) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            session = data.session;
            break;
          }
          await new Promise((r) => setTimeout(r, 100)); // wait 100ms
        }

        if (session) {
          if (type === "recovery" || url.hash.includes("type=recovery")) {
            navigate({ to: "/auth", search: { mode: "reset" }, replace: true });
          } else {
            navigate({ to: "/onboarding", replace: true });
          }
        } else {
          // If no session and no code processed, go back to auth
          toast.error("Sign in failed. Please try again.");
          navigate({ to: "/auth", replace: true });
        }
      }
    };

    processAuth();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
