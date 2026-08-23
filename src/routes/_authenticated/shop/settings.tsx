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
  const [form, setForm] = useState({ shop_name: "", address: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("shopkeepers")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setShop(data);
        setForm({ shop_name: data.shop_name, address: data.address });
        setCoords({ lat: data.latitude, lng: data.longitude });
      });
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop || !coords) return;
    setBusy(true);
    const { error } = await supabase
      .from("shopkeepers")
      .update({
        shop_name: form.shop_name,
        address: form.address,
        latitude: coords.lat,
        longitude: coords.lng,
      })
      .eq("id", shop.id);
    setBusy(false);
    if (error) return toast.error(error.message);
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
