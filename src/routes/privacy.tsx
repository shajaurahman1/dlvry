import { pageHead } from "@/lib/metadata";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DlvryLogo } from "@/components/brand/logo";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => pageHead("Privacy Policy", "How MOVEBY collects, uses and shares data for shops and delivery partners."),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <Link to="/">
            <DlvryLogo className="text-xl" />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-10">
        <p className="font-serif-italic text-sm text-muted-foreground">Effective immediately</p>
        <h1 className="mt-1 text-4xl font-black tracking-tight">Privacy Policy</h1>

        <div className="prose prose-neutral mt-10 max-w-none text-sm leading-relaxed text-foreground/90">
          <Section title="1. Who this applies to">
            <p>
              This policy covers the MOVEBY app and website, used by shopkeepers and independent
              delivery partners. Customers do not create MOVEBY accounts or install the app — they
              are contacted by phone/WhatsApp by the shopkeeper or delivery partner handling their
              order, and their name, phone number and delivery address are entered by the shopkeeper
              for that purpose only.
            </p>
          </Section>

          <Section title="2. Information we collect">
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>
                <strong>Account details:</strong> name, email, phone number and WhatsApp number,
                collected when you sign up and sign in.
              </li>
              <li>
                <strong>Shop or delivery partner profile:</strong> shop name, category, address,
                vehicle details, and — where required for verification — government ID, selfie,
                driving licence, vehicle RC, insurance, pollution certificate, trade licence and shop
                photo.
              </li>
              <li>
                <strong>Location:</strong> delivery partners' live GPS location is collected only
                while the app is open and in the foreground, to match them with nearby pickup
                requests and show the shop their live position during an active delivery. Shop and
                customer addresses are collected as text and, optionally, map coordinates.
              </li>
              <li>
                <strong>Order and delivery data:</strong> pickup and delivery details, order amount,
                delivery charge, payment method (cash or UPI — MOVEBY does not process or hold any
                payment itself) and delivery status history.
              </li>
              <li>
                <strong>Device push token:</strong> collected only if you enable notifications, used
                solely to deliver order and status notifications to your device.
              </li>
            </ul>
          </Section>

          <Section title="3. How we use this information">
            <p>
              We use this information to operate the core service: matching nearby delivery partners
              with shop pickup requests, letting shops and delivery partners contact each other and
              the customer, tracking delivery status, verifying driver/shop documents before
              approval, and sending order-related push notifications.
            </p>
          </Section>

          <Section title="4. Who we share it with">
            <p>We never sell your data. Data is shared only as needed to run the service:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>With the other party to a delivery (e.g. a driver sees the shop's address and
                phone number once assigned; a shop sees the assigned driver's name and phone number).</li>
              <li>With our infrastructure providers, who process data on our behalf: Supabase (sign-in
                and authentication), Turso (database hosting), Google Firebase (push notification
                delivery), and OpenStreetMap/Nominatim (address search and map display — your search
                text is sent to this service when you look up an address).</li>
            </ul>
          </Section>

          <Section title="5. Data retention and deletion">
            <p>
              We keep account and order data for as long as your account is active, and as needed to
              resolve disputes or meet legal obligations. To request deletion of your account and
              data, email us at{" "}
              <a href="mailto:moveby.in@gmail.com" className="underline">moveby.in@gmail.com</a>.
            </p>
          </Section>

          <Section title="6. Children">
            <p>
              MOVEBY is not directed at children and is not knowingly used by anyone under 18 —
              shopkeepers and delivery partners must be adults to register.
            </p>
          </Section>

          <Section title="7. Changes to this policy">
            <p>
              We may update this policy from time to time. Continued use of MOVEBY after a change
              constitutes acceptance of the updated policy.
            </p>
          </Section>

          <Section title="8. Contact">
            <p>
              Questions about this policy or your data can be sent to{" "}
              <a href="mailto:moveby.in@gmail.com" className="underline">moveby.in@gmail.com</a>.
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-2 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}
