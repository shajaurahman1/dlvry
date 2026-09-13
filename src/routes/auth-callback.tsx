import { useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isNativeApp } from "@/lib/platform";
import type { Session } from "@supabase/supabase-js";

export const Route = createFileRoute("/auth-callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const processAuth = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const errorDesc =
        url.searchParams.get("error_description") || hashParams.get("error_description");

      if (errorDesc) {
        toast.error(errorDesc);
        navigate({ to: "/auth", replace: true });
        return;
      }

      const type = url.searchParams.get("type") || hashParams.get("type");
      const isNative = isNativeApp();
      let session: Session | null = null;

      if (code && isNative) {
        // On native, we must exchange the code manually because the deep link
        // doesn't trigger Supabase's automatic on-load processing
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          toast.error(error.message);
          navigate({ to: "/auth", replace: true });
          return;
        }
        session = data.session;
      } else if (hashParams.get("access_token") && hashParams.get("refresh_token")) {
        // Native recovery links use Supabase's implicit flow and put the
        // session in the URL fragment. The deep-link URL is not the WebView
        // URL, so Supabase cannot consume it automatically.
        const { data, error } = await supabase.auth.setSession({
          access_token: hashParams.get("access_token")!,
          refresh_token: hashParams.get("refresh_token")!,
        });
        if (error) {
          toast.error(error.message);
          navigate({ to: "/auth", replace: true });
          return;
        }
        session = data.session;
      } else {
        // The web client may still be processing its callback URL. Poll
        // briefly before treating the callback as failed.
        for (let i = 0; i < 20; i++) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            session = data.session;
            break;
          }
          await new Promise((r) => setTimeout(r, 100)); // wait 100ms
        }
      }

      if (session) {
        if (type === "recovery") {
          navigate({ to: "/auth", search: { mode: "reset" }, replace: true });
        } else {
          navigate({ to: "/", replace: true });
        }
      } else {
        // If no session and no code processed, go back to auth
        toast.error("Sign in failed. Please try again.");
        navigate({ to: "/auth", replace: true });
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
