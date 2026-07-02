import { createFileRoute, Link } from "@tanstack/react-router";
import { DlvryLogo } from "@/components/brand/logo";
import { ArrowRight, PhoneCall, Package, MapPin } from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <DlvryLogo className="text-2xl" />
        <Link
          to="/auth"
          className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="pt-16 pb-24 text-center md:pt-28 md:pb-32">
          <p className="font-serif-italic text-lg text-muted-foreground">Hyperlocal, humanly done.</p>
          <h1 className="mx-auto mt-4 max-w-4xl text-5xl font-black leading-[1.02] tracking-[-0.035em] md:text-7xl">
            Delivery that starts with <span className="font-serif-italic font-normal text-primary">a phone call.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
            DLVRY connects neighborhood shops with nearby delivery partners. No customer app. No payment gateway. Just a call, a driver, and a doorstep.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/auth"
              search={{ role: "shopkeeper" }}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-90"
            >
              I'm a shopkeeper <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/auth"
              search={{ role: "driver" }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-accent"
            >
              I'm a delivery partner
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-24 md:grid-cols-3">
          {[
            { icon: PhoneCall, title: "Customer calls the shop", body: "No app for the customer. Ever. They call, the shop takes the order." },
            { icon: Package, title: "Shop creates a request", body: "Nearby partners within 3 km see the pickup and accept in seconds." },
            { icon: MapPin, title: "Driver delivers, cash settles", body: "Driver pays the shop, delivers, and collects at the door. DLVRY never touches money." },
          ].map((f, i) => (
            <div key={i} className="card-soft p-8">
              <f.icon className="h-6 w-6 text-primary" strokeWidth={1.6} />
              <h3 className="mt-6 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="card-elevated mb-24 flex flex-col items-center gap-6 p-10 text-center md:p-16">
          <p className="font-serif-italic text-primary">Built for the neighborhood.</p>
          <h2 className="max-w-2xl text-3xl font-black leading-tight md:text-5xl">
            No wallet. No gateway. No commission held.
          </h2>
          <p className="max-w-lg text-sm text-muted-foreground">
            DLVRY is only a delivery connector. Money moves directly between the driver, the shop, and the customer.
          </p>
          <Link
            to="/auth"
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-card/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground md:flex-row">
          <DlvryLogo className="text-base" />
          <p>© {new Date().getFullYear()} DLVRY. Made for local commerce.</p>
        </div>
      </footer>
    </div>
  );
}
