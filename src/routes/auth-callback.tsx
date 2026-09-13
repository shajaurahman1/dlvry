import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isNativeApp } from "@/lib/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DlvryLogo } from "@/components/brand/logo";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/auth-callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const processed = useRef(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const processAuth = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const errorDesc =
        url.searchParams.get("error_description") ||
        url.hash.match(/error_description=([^&]+)/)?.[1];

      if (errorDesc) {
        if (url.searchParams.get("type") === "recovery" || url.hash.includes("type=recovery")) {
          setIsRecovery(true);
          setErrorMsg(decodeURIComponent(errorDesc));
        } else {
          toast.error(decodeURIComponent(errorDesc));
          navigate({ to: "/auth", replace: true });
        }
        return;
      }

      const type = url.searchParams.get("type");
      const isNative = isNativeApp();

      // Extract access_token and refresh_token from the hash for native implicit flows (like recovery)
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (code && isNative) {
        // On native, we must exchange the code manually because the deep link
        // doesn't trigger Supabase's automatic on-load processing
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (type === "recovery") {
            setIsRecovery(true);
            setErrorMsg(error.message);
          } else {
            toast.error(error.message);
            navigate({ to: "/auth", replace: true });
          }
        } else {
          if (type === "recovery") {
            setIsRecovery(true);
          } else {
            navigate({ to: "/", replace: true });
          }
        }
      } else if (accessToken && refreshToken) {
        // For implicit flows (like recovery) on web or native, manually set the session
        // because the synthetic hash update might not be caught by Supabase
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          if (type === "recovery" || url.hash.includes("type=recovery")) {
            setIsRecovery(true);
            setErrorMsg(error.message);
          } else {
            toast.error(error.message);
            navigate({ to: "/auth", replace: true });
          }
        } else {
          if (type === "recovery" || url.hash.includes("type=recovery")) {
            setIsRecovery(true);
          } else {
            navigate({ to: "/", replace: true });
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
            setIsRecovery(true);
          } else {
            navigate({ to: "/", replace: true });
          }
        } else {
          if (type === "recovery" || url.hash.includes("type=recovery")) {
            setIsRecovery(true);
            setErrorMsg("Recovery link is invalid or has expired.");
          } else {
            // If no session and no code processed, go back to auth
            toast.error("Sign in failed. Please try again.");
            navigate({ to: "/auth", replace: true });
          }
        }
      }
    };

    processAuth();
  }, [navigate]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setRecoverySuccess(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't update password.");
    } finally {
      setBusy(false);
    }
  };

  if (isRecovery) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-10 flex justify-center">
            <DlvryLogo className="text-3xl" />
          </Link>
          <div className="card-elevated p-8">
            {recoverySuccess ? (
              <div className="text-center">
                <h3 className="mb-4 text-xl font-semibold text-foreground">
                  Password changed successfully.
                </h3>
                <p className="text-sm text-muted-foreground">
                  You can now return to the DLVRY app and sign in with your new password.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6 rounded-lg bg-accent px-3 py-4 text-center">
                  <h3 className="text-base font-semibold text-foreground">Create New Password</h3>
                </div>
                {errorMsg ? (
                  <div className="mb-4 rounded-lg bg-destructive/10 p-4 text-center text-sm text-destructive">
                    {errorMsg}
                  </div>
                ) : (
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div>
                      <Label htmlFor="pw">New Password</Label>
                      <Input
                        id="pw"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="mt-1.5"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="confirmPw">Confirm Password</Label>
                      <Input
                        id="confirmPw"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="mt-1.5"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={busy || !password || password !== confirmPassword}
                      className="h-11 w-full rounded-full text-sm font-semibold"
                    >
                      {busy ? "Please wait…" : "Change Password"}
                    </Button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
