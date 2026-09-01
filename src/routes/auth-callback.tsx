import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

      if (code) {
        // Exchange code
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          toast.error(error.message);
          navigate({ to: "/auth", replace: true });
        } else {
          navigate({ to: "/onboarding", replace: true });
        }
      } else {
        // Fallback for implicit flow or already signed in
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          navigate({ to: "/onboarding", replace: true });
        } else {
          // If no session and no code, wait a bit in case it's processing
          setTimeout(() => {
            navigate({ to: "/auth", replace: true });
          }, 2000);
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
