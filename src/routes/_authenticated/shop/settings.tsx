import { pageHead } from "@/lib/metadata";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, lazy, Suspense } from "react";
import { useAuth } from "@/lib/auth";
import { getMyShop, upsertMyShop } from "@/lib/shop.functions";
import { updateProfile } from "@/lib/profile.functions";
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
import type { PickedLocation } from "@/components/location-picker";

const LocationPicker = lazy(() =>
  import("@/components/location-picker").then((m) => ({ default: m.LocationPicker })),
);

export const Route = createFileRoute("/_authenticated/shop/settings")({ head: () => pageHead("Shop settings", "Update your shop details and location on MOVEBY."), component: ShopSettings });

type Shop = NonNullable<Awaited<ReturnType<typeof getMyShop>>> & {
  id: string; shop_name: string; address: string; shop_category: string | null;
  owner_name: string | null; shop_phone: string | null; gst_number: string | null;
  pan_number: string | null; licence_number: string | null; latitude: number; longitude: number;
};

function ShopSettings() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [shop, setShop] = useState<Shop | null>(null);
  const [coords, setCoords] = useState<PickedLocation | null>(null);
  const [form, setForm] = useState({
    shop_name: "",
    address: "",
    shop_category: "grocery",
    owner_name: "",
    shop_phone: "",
    gst_number: "",
    pan_number: "",
    licence_number: "",
    full_name: "",
    phone: "",
    whatsapp: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const data = (await getMyShop()) as Shop | null;
      if (!data) return;
      setShop(data);
      setForm({
        shop_name: data.shop_name,
        address: data.address,
        shop_category: data.shop_category ?? "grocery",
        owner_name: data.owner_name ?? "",
        shop_phone: data.shop_phone ?? "",
        gst_number: data.gst_number ?? "",
        pan_number: data.pan_number ?? "",
        licence_number: data.licence_number ?? "",
        full_name: (profile?.full_name as string) ?? "",
        phone: (profile?.phone as string) ?? "",
        whatsapp: (profile?.whatsapp as string) ?? "",
      });
      setCoords({ lat: data.latitude, lng: data.longitude });
    })();
  }, [user, profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop || !coords) return;
    setBusy(true);
    try {
      await updateProfile({ data: { full_name: form.full_name, phone: form.phone, whatsapp: form.whatsapp } });
      await upsertMyShop({
        data: {
          shop_name: form.shop_name,
          address: form.address,
          shop_category: form.shop_category,
          owner_name: form.owner_name || undefined,
          shop_phone: form.shop_phone || undefined,
          gst_number: form.gst_number || undefined,
          pan_number: form.pan_number || undefined,
          licence_number: form.licence_number || undefined,
          latitude: coords.lat,
          longitude: coords.lng,
        },
      });
      toast.success("Shop updated");
      navigate({ to: "/shop" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setBusy(false);
    }
  };

  if (!shop)
    return (
      <AppShell title="Shop settings">
        <div className="card-soft p-8 text-center text-sm text-muted-foreground">Loading…</div>
      </AppShell>
    );

  return (
    <AppShell title="Edit shop" subtitle="Update your shop details or location">
      <form onSubmit={save} className="card-elevated space-y-5 p-8">
        <div>
          <Label className="text-sm font-medium">Shop name</Label>
          <Input
            className="mt-1.5"
            value={form.shop_name}
            onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
            required
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="text-sm font-medium">Category</Label>
            <Select
              value={form.shop_category}
              onValueChange={(v) => setForm({ ...form, shop_category: v })}
            >
              <SelectTrigger className="mt-1.5">
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
          </div>
          <div>
            <Label className="text-sm font-medium">Owner name</Label>
            <Input
              className="mt-1.5"
              value={form.owner_name}
              onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Shop phone</Label>
            <Input
              className="mt-1.5"
              value={form.shop_phone}
              onChange={(e) => setForm({ ...form, shop_phone: e.target.value })}
              placeholder="+91…"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Your name</Label>
            <Input
              className="mt-1.5"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Contact phone</Label>
            <Input
              className="mt-1.5"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+91…"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">WhatsApp</Label>
            <Input
              className="mt-1.5"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="+91…"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">GST number</Label>
            <Input
              className="mt-1.5"
              value={form.gst_number}
              onChange={(e) => setForm({ ...form, gst_number: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">PAN number</Label>
            <Input
              className="mt-1.5"
              value={form.pan_number}
              onChange={(e) => setForm({ ...form, pan_number: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Licence number</Label>
            <Input
              className="mt-1.5"
              value={form.licence_number}
              onChange={(e) => setForm({ ...form, licence_number: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label className="text-sm font-medium">Address</Label>
          <Textarea
            className="mt-1.5"
            rows={3}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            required
          />
        </div>
        <Suspense
          fallback={
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              Loading map…
            </div>
          }
        >
          <LocationPicker
            value={coords}
            onChange={(loc) => {
              setCoords(loc);
              if (loc.address) setForm((prev) => ({ ...prev, address: loc.address! }));
            }}
          />
        </Suspense>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/shop" })}
            className="rounded-full"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={busy || !coords}
            className="h-11 flex-1 rounded-full font-semibold"
          >
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
