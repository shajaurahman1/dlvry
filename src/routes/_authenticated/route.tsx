import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: Gate,
});

// Login is temporarily bypassed: AuthProvider signs the device in
// anonymously on its own, so there's normally nothing to gate here. This
// only shows anything when that automatic sign-in itself fails (e.g. no
// network), and even then it's a retry action, never a login form.
function Gate() {
  const { user, loading, bypassError, retryBypass } = useAuth();

  if (bypassError && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-muted-foreground">Couldn't connect. Check your connection.</p>
        <button
          onClick={() => void retryBypass()}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  return <Outlet />;
}
