import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, lazy, Suspense } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { PickedLocation } from "@/components/location-picker";
import type { Tables } from "@/integrations/supabase/types";

const LocationPicker = lazy(() =>
  import("@/components/location-picker").then((m) => ({ default: m.LocationPicker })),
);

export const Route = createFileRoute("/_authenticated/shop/settings")({ component: ShopSettings });

type Shop = Tables<"shopkeepers">;

function ShopSettings() {
  const { user } = useAuth();
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
      const [{ data }, { data: p }] = await Promise.all([
        supabase.from("shopkeepers").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      ]);
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
        full_name: p?.full_name ?? "",
        phone: p?.phone ?? "",
        whatsapp: p?.whatsapp ?? "",
      });
      setCoords({ lat: data.latitude, lng: data.longitude });
    })();
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop || !coords) return;
    setBusy(true);
    const { error: pe } = await supabase
      .from("profiles")
      .update({ full_name: form.full_name, phone: form.phone, whatsapp: form.whatsapp })
      .eq("id", shop.id);
    const { error } = await supabase
      .from("shopkeepers")
      .update({
        shop_name: form.shop_name,
        address: form.address,
        shop_category: form.shop_category,
        owner_name: form.owner_name || null,
        shop_phone: form.shop_phone || null,
        gst_number: form.gst_number || null,
        pan_number: form.pan_number || null,
        licence_number: form.licence_number || null,
        latitude: coords.lat,
        longitude: coords.lng,
      })
      .eq("id", shop.id);
    setBusy(false);
    if (pe || error) return toast.error((pe ?? error)!.message);
    toast.success("Shop updated");
    navigate({ to: "/shop" });
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
