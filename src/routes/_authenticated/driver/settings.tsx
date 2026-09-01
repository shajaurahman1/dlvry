import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/driver/settings")({
  component: DriverSettings,
});

type VehicleType = "walking" | "cycle" | "bike" | "car";

function DriverSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    full_name: "",
    phone: "",
    whatsapp: "",
    date_of_birth: "",
    home_address: "",
    vehicle_type: "bike" as VehicleType,
    vehicle_number: "",
    available_cash: "0",
    payout_upi: "",
    bank_details: "",
    search_radius_km: "3",
  });

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: p }, { data: d }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("drivers").select("*").eq("id", user.id).maybeSingle(),
      ]);
      setF({
        full_name: p?.full_name ?? "",
        phone: p?.phone ?? "",
        whatsapp: p?.whatsapp ?? "",
        date_of_birth: d?.date_of_birth ?? "",
        home_address: d?.home_address ?? "",
        vehicle_type: (d?.vehicle_type as VehicleType) ?? "bike",
        vehicle_number: d?.vehicle_number ?? "",
        available_cash: String(d?.available_cash ?? 0),
        payout_upi: d?.payout_upi ?? "",
        bank_details: d?.bank_details ?? "",
        search_radius_km: String(d?.search_radius_km ?? 3),
      });
      setReady(true);
    })();
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const { error: pe } = await supabase
        .from("profiles")
        .update({ full_name: f.full_name, phone: f.phone, whatsapp: f.whatsapp })
        .eq("id", user.id);
      if (pe) throw pe;
      const { error: de } = await supabase
        .from("drivers")
        .update({
          date_of_birth: f.date_of_birth || null,
          home_address: f.home_address || null,
          vehicle_type: f.vehicle_type,
          vehicle_number: f.vehicle_number || null,
          available_cash: Number(f.available_cash) || 0,
          payout_upi: f.payout_upi || null,
          bank_details: f.bank_details || null,
          search_radius_km: Number(f.search_radius_km) || 3,
        })
        .eq("id", user.id);
      if (de) throw de;
      toast.success("Profile updated");
      navigate({ to: "/driver" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save changes");
    } finally {
      setBusy(false);
    }
  };

  if (!ready)
    return (
      <AppShell title="Edit profile">
        <div className="card-soft p-8 text-center text-sm text-muted-foreground">Loading…</div>
      </AppShell>
    );

  return (
    <AppShell title="Edit profile" subtitle="Delivery partner">
      <form onSubmit={save} className="card-elevated space-y-5 p-8">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Full name</Label>
            <Input
              className="mt-1.5"
              value={f.full_name}
              onChange={(e) => setF({ ...f, full_name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Date of birth</Label>
            <Input
              className="mt-1.5"
              type="date"
              value={f.date_of_birth}
              onChange={(e) => setF({ ...f, date_of_birth: e.target.value })}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              className="mt-1.5"
              value={f.phone}
              onChange={(e) => setF({ ...f, phone: e.target.value })}
              placeholder="+91…"
            />
          </div>
          <div>
            <Label>WhatsApp</Label>
            <Input
              className="mt-1.5"
              value={f.whatsapp}
              onChange={(e) => setF({ ...f, whatsapp: e.target.value })}
              placeholder="+91…"
            />
          </div>
        </div>

        <div>
          <Label>Home address</Label>
          <Textarea
            className="mt-1.5"
            rows={2}
            value={f.home_address}
            onChange={(e) => setF({ ...f, home_address: e.target.value })}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Vehicle</Label>
            <Select
              value={f.vehicle_type}
              onValueChange={(v) => setF({ ...f, vehicle_type: v as VehicleType })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["walking", "cycle", "bike", "car"] as VehicleType[]).map((v) => (
                  <SelectItem key={v} value={v} className="capitalize">
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Vehicle number</Label>
            <Input
              className="mt-1.5"
              value={f.vehicle_number}
              onChange={(e) => setF({ ...f, vehicle_number: e.target.value })}
            />
          </div>
          <div>
            <Label>Cash in hand (₹)</Label>
            <Input
              className="mt-1.5"
              type="number"
              min="0"
              value={f.available_cash}
              onChange={(e) => setF({ ...f, available_cash: e.target.value })}
            />
          </div>
          <div>
            <Label>Alert radius</Label>
            <Select
              value={f.search_radius_km}
              onValueChange={(v) => setF({ ...f, search_radius_km: v })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["1", "2", "3"].map((v) => (
                  <SelectItem key={v} value={v}>
                    {v} km
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Payout UPI</Label>
            <Input
              className="mt-1.5"
              value={f.payout_upi}
              onChange={(e) => setF({ ...f, payout_upi: e.target.value })}
              placeholder="name@upi"
            />
          </div>
          <div>
            <Label>Bank details</Label>
            <Input
              className="mt-1.5"
              value={f.bank_details}
              onChange={(e) => setF({ ...f, bank_details: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => navigate({ to: "/driver" })}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={busy} className="h-11 flex-1 rounded-full font-semibold">
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
