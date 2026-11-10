import { pageHead } from "@/lib/metadata";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getMyDriver, upsertMyDriver } from "@/lib/driver.functions";
import { updateProfile } from "@/lib/profile.functions";
import { errorMessage } from "@/lib/utils";
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
import { CURRENCIES, currencyForCountry } from "@/lib/orders";
import { getPositionOnce, reverseGeocodeLookup } from "@/lib/geo";
import { MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/driver/settings")({
  head: () =>
    pageHead(
      "Delivery partner settings",
      "Update your delivery profile and alert radius on MOVEBY.",
    ),
  component: DriverSettings,
});

type VehicleType = "walking" | "cycle" | "bike" | "car";

function DriverSettings() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detecting, setDetecting] = useState(false);
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
    currency: "INR",
  });

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const d = (await getMyDriver()) as Record<string, unknown> | null;
      setF({
        full_name: (profile?.full_name as string) ?? "",
        phone: (profile?.phone as string) ?? "",
        whatsapp: (profile?.whatsapp as string) ?? "",
        date_of_birth: (d?.date_of_birth as string) ?? "",
        home_address: (d?.home_address as string) ?? "",
        vehicle_type: (d?.vehicle_type as VehicleType) ?? "bike",
        vehicle_number: (d?.vehicle_number as string) ?? "",
        available_cash: String(d?.available_cash ?? 0),
        payout_upi: (d?.payout_upi as string) ?? "",
        bank_details: (d?.bank_details as string) ?? "",
        search_radius_km: String(d?.search_radius_km ?? 3),
        currency: (d?.currency as string) ?? "INR",
      });
      setReady(true);
    })();
  }, [user, profile]);

  const detectCurrency = async () => {
    setDetecting(true);
    try {
      const fix = await getPositionOnce({ highAccuracy: false, timeout: 8000 });
      const geo = await reverseGeocodeLookup(fix.lat, fix.lng);
      if (!geo.countryCode) {
        toast.error("Couldn't figure out your country — check GPS and try again.");
        return;
      }
      const detected = currencyForCountry(geo.countryCode);
      setF((prev) => ({ ...prev, currency: detected }));
      toast.success(`Set to ${CURRENCIES[detected]?.label ?? detected}`);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't get your location"));
    } finally {
      setDetecting(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      await updateProfile({
        data: { full_name: f.full_name, phone: f.phone, whatsapp: f.whatsapp },
      });
      await upsertMyDriver({
        data: {
          date_of_birth: f.date_of_birth || undefined,
          home_address: f.home_address || undefined,
          vehicle_type: f.vehicle_type,
          vehicle_number: f.vehicle_number || undefined,
          available_cash: Number(f.available_cash) || 0,
          payout_upi: f.payout_upi || undefined,
          bank_details: f.bank_details || undefined,
          search_radius_km: Number(f.search_radius_km) || 3,
          currency: f.currency,
        },
      });
      toast.success("Profile updated");
      navigate({ to: "/driver" });
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save changes"));
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
            <Label>Cash in hand ({CURRENCIES[f.currency]?.symbol ?? "₹"})</Label>
            <Input
              className="mt-1.5"
              type="number"
              min="0"
              value={f.available_cash}
              onChange={(e) => setF({ ...f, available_cash: e.target.value })}
            />
          </div>
          <div>
            <Label>Currency</Label>
            <div className="mt-1.5 flex gap-2">
              <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v })}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CURRENCIES).map(([code, c]) => (
                    <SelectItem key={code} value={code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={detecting}
                onClick={detectCurrency}
                aria-label="Detect from my location"
              >
                <MapPin className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              What your earnings are shown in — the shops you deliver for should match. Tap{" "}
              <MapPin className="inline h-3 w-3" /> to set it from where you are right now.
            </p>
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
