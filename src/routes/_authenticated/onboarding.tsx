import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, lazy, Suspense } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Store, Bike } from "lucide-react";
import { toast } from "sonner";
import type { PickedLocation } from "@/components/location-picker";

const LocationPicker = lazy(() =>
  import("@/components/location-picker").then((m) => ({ default: m.LocationPicker })),
);

export const Route = createFileRoute("/_authenticated/onboarding")({ component: Onboarding });

function Onboarding() {
  const { user, roles, refresh, loading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<"shopkeeper" | "driver" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (roles.includes("admin")) navigate({ to: "/admin" });
    else if (roles.includes("shopkeeper")) navigate({ to: "/shop" });
    else if (roles.includes("driver")) navigate({ to: "/driver" });
  }, [roles, loading, navigate]);

  if (!user) return null;

  if (!role) {
    return (
      <AppShell title="Choose your role" subtitle="What brings you to DLVRY?">
        <div className="grid gap-4 md:grid-cols-2">
          <button
            onClick={() => setRole("shopkeeper")}
            className="card-soft group p-8 text-left transition hover:shadow-elevated"
          >
            <Store className="h-8 w-8 text-primary" strokeWidth={1.5} />
            <h3 className="mt-6 text-xl font-bold">Business</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Take customer calls and dispatch orders to nearby delivery partners.
            </p>
          </button>
          <button
            onClick={() => setRole("driver")}
            className="card-soft group p-8 text-left transition hover:shadow-elevated"
          >
            <Bike className="h-8 w-8 text-primary" strokeWidth={1.5} />
            <h3 className="mt-6 text-xl font-bold">Delivery partner</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Accept orders from shops within 3 km of your live location.
            </p>
          </button>
        </div>
      </AppShell>
    );
  }

  return role === "shopkeeper" ? (
    <ShopkeeperForm
      onDone={async () => {
        await refresh();
        navigate({ to: "/shop" });
      }}
      setBusy={setBusy}
      busy={busy}
      userId={user.id}
    />
  ) : (
    <DriverForm
      onDone={async () => {
        await refresh();
        navigate({ to: "/driver" });
      }}
      setBusy={setBusy}
      busy={busy}
      userId={user.id}
    />
  );
}

function ShopkeeperForm({
  onDone,
  setBusy,
  busy,
  userId,
}: {
  onDone: () => void;
  setBusy: (b: boolean) => void;
  busy: boolean;
  userId: string;
}) {
  const [f, setF] = useState({
    shop_name: "",
    shop_category: "grocery",
    address: "",
    phone: "",
    whatsapp: "",
    gst_number: "",
  });
  const [coords, setCoords] = useState<PickedLocation | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coords) return toast.error("Choose your shop location (GPS or map) first");
    if (!f.shop_name.trim() || !f.address.trim())
      return toast.error("Shop name and address are required");
    setBusy(true);
    try {
      await supabase
        .from("profiles")
        .update({ phone: f.phone, whatsapp: f.whatsapp })
        .eq("id", userId);
      const { error } = await supabase.from("shopkeepers").upsert(
        {
          id: userId,
          shop_name: f.shop_name,
          shop_category: f.shop_category,
          address: f.address,
          latitude: coords.lat,
          longitude: coords.lng,
          gst_number: f.gst_number || null,
        },
        { onConflict: "id" },
      );
      if (error) throw error;
      await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: "shopkeeper" }, { onConflict: "user_id,role" });
      toast.success("You're all set — welcome to DLVRY");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppShell title="Shop details" subtitle="Tell us about your shop">
      <form onSubmit={submit} className="card-elevated space-y-5 p-8">
        <Field label="Shop name">
          <Input
            value={f.shop_name}
            onChange={(e) => setF({ ...f, shop_name: e.target.value })}
            required
          />
        </Field>
        <Field label="Category">
          <Select value={f.shop_category} onValueChange={(v) => setF({ ...f, shop_category: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "grocery",
                "pharmacy",
                "restaurant",
                "bakery",
                "stationery",
                "electronics",
                "other",
              ].map((c) => (
                <SelectItem key={c} value={c} className="capitalize">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Phone">
            <Input
              value={f.phone}
              onChange={(e) => setF({ ...f, phone: e.target.value })}
              placeholder="+91…"
            />
          </Field>
          <Field label="WhatsApp">
            <Input
              value={f.whatsapp}
              onChange={(e) => setF({ ...f, whatsapp: e.target.value })}
              placeholder="+91…"
            />
          </Field>
        </div>
        <Field label="Full address">
          <Textarea
            value={f.address}
            onChange={(e) => setF({ ...f, address: e.target.value })}
            rows={3}
            required
          />
        </Field>
        <Field label="GST number (optional)">
          <Input
            value={f.gst_number}
            onChange={(e) => setF({ ...f, gst_number: e.target.value })}
          />
        </Field>
        <Suspense
          fallback={
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              Loading location tools…
            </div>
          }
        >
          <LocationPicker
            value={coords}
            onChange={(loc) => {
              setCoords(loc);
              if (loc.address && !f.address) setF((prev) => ({ ...prev, address: loc.address! }));
            }}
          />
        </Suspense>
        <Button
          type="submit"
          disabled={busy || !coords}
          className="h-11 w-full rounded-full font-semibold"
        >
          {busy ? "Submitting…" : "Save & continue"}
        </Button>
      </form>
    </AppShell>
  );
}

function DriverForm({
  onDone,
  setBusy,
  busy,
  userId,
}: {
  onDone: () => void;
  setBusy: (b: boolean) => void;
  busy: boolean;
  userId: string;
}) {
  const [f, setF] = useState({
    phone: "",
    whatsapp: "",
    date_of_birth: "",
    home_address: "",
    emergency_contact: "",
    vehicle_type: "bike" as "walking" | "cycle" | "bike" | "car",
    vehicle_number: "",
    available_cash: "1000",
  });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await supabase
        .from("profiles")
        .update({ phone: f.phone, whatsapp: f.whatsapp })
        .eq("id", userId);
      const { error } = await supabase.from("drivers").upsert(
        {
          id: userId,
          date_of_birth: f.date_of_birth || null,
          home_address: f.home_address,
          emergency_contact: f.emergency_contact,
          vehicle_type: f.vehicle_type,
          vehicle_number: f.vehicle_number || null,
          available_cash: Number(f.available_cash) || 0,
        },
        { onConflict: "id" },
      );
      if (error) throw error;
      await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: "driver" }, { onConflict: "user_id,role" });
      toast.success("You're all set — welcome to DLVRY");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppShell title="Delivery partner details" subtitle="A few details and you're in">
      <form onSubmit={submit} className="card-elevated space-y-5 p-8">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Phone">
            <Input
              value={f.phone}
              onChange={(e) => setF({ ...f, phone: e.target.value })}
              required
            />
          </Field>
          <Field label="WhatsApp">
            <Input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} />
          </Field>
          <Field label="Date of birth">
            <Input
              type="date"
              value={f.date_of_birth}
              onChange={(e) => setF({ ...f, date_of_birth: e.target.value })}
            />
          </Field>
          <Field label="Emergency contact">
            <Input
              value={f.emergency_contact}
              onChange={(e) => setF({ ...f, emergency_contact: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Home address">
          <Textarea
            rows={2}
            value={f.home_address}
            onChange={(e) => setF({ ...f, home_address: e.target.value })}
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Vehicle type">
            <Select
              value={f.vehicle_type}
              onValueChange={(v) => setF({ ...f, vehicle_type: v as typeof f.vehicle_type })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["walking", "cycle", "bike", "car"] as const).map((v) => (
                  <SelectItem key={v} value={v} className="capitalize">
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Vehicle number (optional)">
            <Input
              value={f.vehicle_number}
              onChange={(e) => setF({ ...f, vehicle_number: e.target.value })}
            />
          </Field>
        </div>
        <Field
          label="Available cash (₹)"
          hint="You'll only see orders up to this amount, since you pay the shop up front."
        >
          <Input
            type="number"
            min="0"
            value={f.available_cash}
            onChange={(e) => setF({ ...f, available_cash: e.target.value })}
          />
        </Field>
        <Button type="submit" disabled={busy} className="h-11 w-full rounded-full font-semibold">
          {busy ? "Submitting…" : "Save & continue"}
        </Button>
      </form>
    </AppShell>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
