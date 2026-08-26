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
