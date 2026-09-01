import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DlvryLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { z } from "zod";

type SearchParams = { role?: "shopkeeper" | "driver" | "admin"; mode?: "signin" | "signup" };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    role: s.role === "shopkeeper" || s.role === "driver" || s.role === "admin" ? s.role : undefined,
    mode: s.mode === "signup" ? "signup" : "signin",
  }),
  component: AuthPage,
});

const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

const schema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => gmailRegex.test(v), "Please enter a valid Gmail address."),
  password: z.string().min(6, "At least 6 characters"),
  fullName: z.string().trim().max(100).optional(),
});

function AuthPage() {
  const { role, mode } = Route.useSearch();
  const navigate = useNavigate();
  const { user, roles, loading } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">(mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      if (roles.includes("admin")) navigate({ to: "/admin" });
      else if (roles.includes("shopkeeper")) navigate({ to: "/shop" });
      else if (roles.includes("driver")) navigate({ to: "/driver" });
      else navigate({ to: "/onboarding" });
    }
  }, [loading, user, roles, navigate]);

  const forgotPassword = async () => {
    const em = email.trim().toLowerCase();
    if (!em.endsWith("@gmail.com")) {
      toast.error("Enter your @gmail.com address first.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success("Password reset link sent. Check your Gmail inbox.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't send the reset link.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, fullName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      if (tab === "signup") {
        if (!acceptTerms) {
          toast.error("Please accept the Terms & Conditions to continue.");
          setBusy(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding`,
            data: { full_name: fullName, intended_role: role ?? "shopkeeper" },
          },
        });
        if (error) throw error;
        toast.success("Account created. Let's set up your profile.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      const lower = msg.toLowerCase();
      if (lower.includes("invalid login") || lower.includes("invalid credentials")) {
        toast.error(tab === "signin" ? "Gmail account not found." : "Wrong email or password");
      } else if (lower.includes("user not found")) {
        toast.error("Gmail account not found.");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-10 flex justify-center">
          <DlvryLogo className="text-3xl" />
        </Link>
        <div className="card-elevated p-8">
          <div className="mb-6 flex gap-1 rounded-full bg-muted p-1">
            {(["signin", "signup"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                  tab === t ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"
                }`}
              >
                {t === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          {role && tab === "signup" && (
            <p className="mb-4 rounded-lg bg-accent px-3 py-2 text-xs text-muted-foreground">
              Signing up as <span className="font-semibold capitalize text-foreground">{role}</span>
            </p>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await lovable.auth.signInWithOAuth("google", {
                  redirect_uri: window.location.origin,
                });
                if (result.error) {
                  toast.error("Google sign-in failed. Please try again.");
                  return;
                }
                if (result.redirected) return;
              } catch {
                toast.error("Google sign-in failed. Please try again.");
              } finally {
                setBusy(false);
              }
            }}
            className="mb-4 flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-card text-sm font-semibold transition hover:bg-muted disabled:opacity-60"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
              />
              <path
                fill="#FBBC05"
                d="M5.85 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.67-2.84Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.12 14.96 1 12 1a11 11 0 0 0-9.82 6.05l3.67 2.84c.86-2.6 3.29-4.51 6.15-4.51Z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {tab === "signup" && (
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  className="mt-1.5"
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1.5"
                required
              />
            </div>
            <div>
              <Label htmlFor="pw">Password</Label>
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
            {tab === "signup" && (
              <label className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-[color:oklch(0.55_0.13_155)]"
                />
                <span>
                  I have read and agree to the{" "}
                  <Link
                    to="/terms"
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    Terms &amp; Conditions
                  </Link>
                  .
                </span>
              </label>
            )}
            <Button
              type="submit"
              disabled={busy || (tab === "signup" && !acceptTerms)}
              className="h-11 w-full rounded-full text-sm font-semibold"
            >
              {busy ? "Please wait…" : tab === "signin" ? "Sign in" : "Create account"}
            </Button>
            {tab === "signin" && (
              <button
                type="button"
                onClick={forgotPassword}
                className="w-full text-center text-xs font-medium text-muted-foreground underline underline-offset-2"
              >
                Forgot password?
              </button>
            )}
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/terms" className="underline underline-offset-2">
            Terms &amp; Conditions
          </Link>
        </p>
      </div>
    </div>
  );
}
