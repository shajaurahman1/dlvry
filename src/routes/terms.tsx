import { createFileRoute, Link } from "@tanstack/react-router";
import { DlvryLogo } from "@/components/brand/logo";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — DLVRY" },
      { name: "description", content: "DLVRY is a technology platform connecting shopkeepers with nearby delivery partners. Read the terms of use." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <Link to="/"><DlvryLogo className="text-xl" /></Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-10">
        <p className="font-serif-italic text-sm text-muted-foreground">Effective immediately</p>
        <h1 className="mt-1 text-4xl font-black tracking-tight">Terms &amp; Conditions</h1>

        <div className="prose prose-neutral mt-10 max-w-none text-sm leading-relaxed text-foreground/90">
          <Section title="1. What DLVRY is">
            <p>
              DLVRY is a technology platform that connects independent shopkeepers with independent delivery partners
              operating in the same area. DLVRY does not sell products, does not employ delivery partners, does not
              transport goods, and does not collect or hold any payments. Customers do not use the DLVRY application —
              they place orders by calling the shopkeeper directly.
            </p>
          </Section>

          <Section title="2. Role of DLVRY">
            <p>
              DLVRY only introduces shopkeepers and delivery partners. All communication, cash handling, product
              handover and delivery arrangements happen entirely between the shopkeeper, the delivery partner and the
              customer. DLVRY is not a party to any transaction between them.
            </p>
          </Section>

          <Section title="3. Payments">
            <p>
              All payments occur directly between the shopkeeper, the delivery partner and the customer in cash or by
              any private arrangement between them. DLVRY does not process, collect, hold, refund, guarantee or
              reconcile any payment. Any dispute regarding payment is strictly between the parties involved.
            </p>
          </Section>

          <Section title="4. No guarantee of delivery">
            <p>
              DLVRY does not guarantee that any order will be accepted, picked up, delivered on time, or delivered at
              all. Whether an order is fulfilled depends entirely on the availability, decisions and conduct of the
              shopkeeper and delivery partner.
            </p>
          </Section>

          <Section title="5. Limitation of liability">
            <p>DLVRY is not responsible or liable, under any circumstance, for any of the following:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Fraud, theft, cheating or misrepresentation by any user</li>
              <li>Non-payment, short payment or delayed payment by any party</li>
              <li>Product quality, condition, freshness, expiry, weight or packaging</li>
              <li>Wrong, missing, damaged, incomplete or substituted deliveries</li>
              <li>Disputes between customer, shopkeeper and delivery partner</li>
              <li>Sale, delivery or possession of illegal, restricted or prohibited items</li>
              <li>Road accidents, vehicle damage, personal injury or death</li>
              <li>Property damage, loss, robbery or crime of any kind</li>
              <li>Regulatory, tax, licensing or legal issues faced by any user</li>
              <li>Any indirect, incidental, consequential or punitive damages</li>
            </ul>
          </Section>

          <Section title="6. User responsibility">
            <p>
              Every user — shopkeeper and delivery partner — uses the platform entirely at their own risk. Every user
              is solely responsible for complying with all applicable local, state and national laws, including but not
              limited to licensing, taxation, food safety, transport regulations and consumer protection laws.
            </p>
          </Section>

          <Section title="7. Account controls">
            <p>
              DLVRY reserves the right to suspend, block, deactivate or permanently remove any account at any time,
              with or without notice, for any reason including but not limited to suspected fraud, misuse, unsafe
              conduct or violation of these terms.
            </p>
          </Section>

          <Section title="8. Data & communication">
            <p>
              By registering, users consent to their name, phone number, address, shop information and location being
              shared with counterparties on the platform strictly for the purpose of coordinating deliveries.
            </p>
          </Section>

          <Section title="9. Acceptance">
            <p>
              By ticking the acceptance checkbox during registration and by using the platform, the user confirms that
              they have read, understood and agreed to these Terms &amp; Conditions in full.
            </p>
          </Section>
        </div>

        <div className="mt-12 rounded-2xl border border-border bg-muted/40 p-6 text-xs text-muted-foreground">
          If any provision of these terms is found unenforceable, the remaining provisions remain in full effect.
          DLVRY may update these terms at any time; continued use of the platform after an update constitutes
          acceptance of the updated terms.
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
