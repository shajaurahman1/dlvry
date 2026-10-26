import { pageHead } from "@/lib/metadata";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DlvryLogo } from "@/components/brand/logo";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/delete-account")({
  head: () => pageHead("Delete your account", "How to request deletion of your MOVEBY account and data."),
  component: DeleteAccountPage,
});

function DeleteAccountPage() {
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
        <h1 className="text-4xl font-black tracking-tight">Delete your MOVEBY account</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          To request deletion of your MOVEBY account and data, email{" "}
          <a href="mailto:moveby.in@gmail.com?subject=Delete%20my%20MOVEBY%20account" className="font-medium text-primary underline">
            moveby.in@gmail.com
          </a>{" "}
          from the email address registered on your account, with the subject line "Delete my
          MOVEBY account". Include the phone number on your account so we can verify it's you.
        </p>

        <h2 className="mt-10 text-lg font-bold">What happens next</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          We'll confirm the request by replying to your email, then delete your account within 7
          days.
        </p>

        <h2 className="mt-10 text-lg font-bold">What gets deleted</h2>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-sm leading-relaxed text-muted-foreground">
          <li>Your profile: name, email, phone, WhatsApp number</li>
          <li>Your shop or delivery partner profile, including any uploaded verification documents</li>
          <li>Your live location and device push notification token</li>
        </ul>

        <h2 className="mt-10 text-lg font-bold">What we keep, and why</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Completed order records (amounts, dates, the shop/driver involved) are retained for a
          limited period after deletion where needed to resolve an open dispute or complaint, or to
          meet a legal or tax obligation. They're no longer linked to a usable account once yours is
          deleted.
        </p>

        <p className="mt-10 text-xs text-muted-foreground">
          See the full{" "}
          <Link to="/privacy" className="underline">Privacy Policy</Link> for how MOVEBY handles
          data more broadly.
        </p>
      </main>
    </div>
  );
}
