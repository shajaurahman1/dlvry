import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { DlvryLogo } from "@/components/brand/logo";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { StoryWheel } from "@/components/story-wheel";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/metadata";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead(
      "Local delivery, connected",
      "MOVEBY connects local shops with nearby delivery partners. Customer calls, local pickups and direct doorstep payments.",
    ),
  component: Landing,
});

function Landing() {
  const { user, roles, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      if (roles.includes("admin")) navigate({ to: "/admin", replace: true });
      else if (roles.includes("shopkeeper")) navigate({ to: "/shop", replace: true });
      else if (roles.includes("driver")) navigate({ to: "/driver", replace: true });
      else navigate({ to: "/onboarding", replace: true });
    }
  }, [user, roles, loading, navigate]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <DlvryLogo className="animate-pulse text-4xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <DlvryLogo className="text-2xl" />
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="pt-10 pb-14 text-center md:pt-12 md:pb-16">
          <h1 className="mb-7 flex justify-center">
            <Link to="/" aria-label="MOVEBY home">
              <DlvryLogo className="home-logo" />
            </Link>
          </h1>
          <p className="font-serif-italic text-lg text-muted-foreground">
            Hyperlocal, humanly done.
          </p>
          <h2 className="mx-auto mt-4 max-w-4xl text-4xl font-black leading-tight md:text-5xl">
            Delivery that starts with{" "}
            <span className="font-serif-italic font-normal text-primary">a phone call.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
            Collect payment with delivery charges at the doorstep.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild className="h-auto rounded-full px-6 py-3">
              <Link to="/auth" search={{ role: "shopkeeper" }}>
                I'm a business partner <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto rounded-full px-6 py-3">
              <Link to="/auth" search={{ role: "driver" }}>
                I'm a delivery partner
              </Link>
            </Button>
          </div>
        </section>

        <StoryWheel />

        <section className="mb-12 flex flex-col items-center gap-6 py-14 text-center md:py-20">
          <p className="font-serif-italic text-primary">Built for the neighborhood.</p>
          <h2 className="max-w-2xl text-3xl font-black leading-tight md:text-5xl">
            No wallet. No gateway. No commission held.
          </h2>
          <p className="max-w-lg text-sm text-muted-foreground">
            MOVEBY is only a delivery connector. Money moves directly between the driver, the shop,
            and the customer.
          </p>
          <Button asChild className="mt-2 h-auto rounded-full px-6 py-3">
            <Link to="/auth">
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-card/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground md:flex-row">
          <DlvryLogo className="text-base" />
          <p>© {new Date().getFullYear()} MOVEBY. Made for local commerce.</p>
        </div>
      </footer>
    </div>
  );
}
