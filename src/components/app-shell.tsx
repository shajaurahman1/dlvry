import { Link, useNavigate } from "@tanstack/react-router";
import { DlvryLogo } from "@/components/brand/logo";
import { BackButton } from "@/components/back-button";
import { useAuth } from "@/lib/auth";
import { LogOut } from "lucide-react";
import { type ReactNode } from "react";

export function AppShell({ children, title, subtitle, actions }: { children: ReactNode; title?: string; subtitle?: string; actions?: ReactNode }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <BackButton />
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link to="/"><DlvryLogo className="text-xl" /></Link>
          <button
            onClick={async () => { await signOut(); navigate({ to: "/" }); }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 pb-24 pt-8">
        {(title || actions) && (
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              {subtitle && <p className="font-serif-italic text-sm text-muted-foreground">{subtitle}</p>}
              {title && <h1 className="mt-1 text-3xl font-black tracking-tight md:text-4xl">{title}</h1>}
            </div>
            {actions}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
