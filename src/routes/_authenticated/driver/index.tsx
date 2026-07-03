import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useLiveLocation } from "@/lib/geo";
import { MapPin, Navigation, Phone, Package } from "lucide-react";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, fmtINR, timeAgo } from "@/lib/orders";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/driver/")({ component: DriverDashboard });

type Driver = Tables<"drivers">;
type Order = Tables<"orders">;

interface NearbyOrder {
  id: string;
  shop_id: string;
  shop_name: string;
  pickup_address: string;
  order_amount: number;
  delivery_charge: number;
  total_amount: number;
  pickup_lat: number;
  pickup_lng: number;
  distance_km: number;
  created_at: string;
}

function DriverDashboard() {
  const { user, roles, loading } = useAuth();
  const navigate = useNavigate();
  const loc = useLiveLocation(true);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [nearby, setNearby] = useState<NearbyOrder[]>([]);
  const [active, setActive] = useState<Order | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!roles.includes("driver") && !roles.includes("admin")) navigate({ to: "/onboarding" });
  }, [roles, loading, navigate]);

  const loadDriver = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("drivers").select("*").eq("id", user.id).maybeSingle();
    setDriver(data);
  }, [user]);

  useEffect(() => { void loadDriver(); }, [loadDriver]);

  // Push live location to DB
  useEffect(() => {
    if (loc.status !== "granted" || !user) return;
    void supabase.from("drivers").update({
      current_lat: loc.coords.lat,
      current_lng: loc.coords.lng,
      location_updated_at: new Date().toISOString(),
    }).eq("id", user.id);
  }, [loc, user]);

  const loadOrders = useCallback(async () => {
    if (!user || loc.status !== "granted") return;
    const [{ data: rpc }, { data: mine }] = await Promise.all([
      supabase.rpc("nearby_orders", { driver_lat: loc.coords.lat, driver_lng: loc.coords.lng }),
      supabase.from("orders").select("*").eq("driver_id", user.id).not("status", "in", "(delivered,cancelled)").order("created_at", { ascending: false }).limit(1),
    ]);
    setNearby((rpc as NearbyOrder[]) ?? []);
    setActive((mine?.[0] as Order) ?? null);
  }, [user, loc]);

  useEffect(() => {
    void loadOrders();
    if (!user) return;
    const ch = supabase
      .channel("driver-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadOrders())
      .subscribe();
    const iv = setInterval(loadOrders, 20000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  }, [loadOrders, user]);

  // Location gate
  if (loc.status !== "granted") return <LocationBlock state={loc.status} />;

  if (!driver) {
    return (
      <AppShell title="Complete your profile">
        <div className="card-soft p-8 text-center">
          <Button className="rounded-full" onClick={() => navigate({ to: "/onboarding" })}>Set up profile</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell subtitle="Live" title="Delivery">
      {driver.approval_status !== "approved" && (
        <div className="mb-6 card-soft border-warning/40 bg-warning/10 p-4">
          <p className="text-sm font-medium">Awaiting admin approval</p>
          <p className="mt-1 text-xs text-muted-foreground">Once approved, nearby orders will appear here.</p>
        </div>
      )}

      <div className="card-elevated mb-6 flex items-center gap-4 p-5">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
          <MapPin className="h-5 w-5" />
        </div>
        <div className="flex-1 text-sm">
          <p className="font-semibold">Live location active</p>
          <p className="text-xs text-muted-foreground">
            {loc.coords.lat.toFixed(4)}, {loc.coords.lng.toFixed(4)} · Cash cap {fmtINR(driver.available_cash)}
          </p>
        </div>
      </div>

      {active ? (
        <ActiveOrder order={active} onChange={loadOrders} />
      ) : (
        <>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Nearby orders</h2>
          {nearby.length === 0 ? (
            <div className="card-soft p-10 text-center">
              <p className="font-serif-italic text-muted-foreground">No orders nearby.</p>
              <p className="mt-2 text-sm text-muted-foreground">We only show orders within 3 km of your live location.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {nearby.map((o) => <NearbyCard key={o.id} order={o} onAccepted={loadOrders} />)}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

function NearbyCard({ order, onAccepted }: { order: NearbyOrder; onAccepted: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("orders")
      .update({ driver_id: user.id, status: "accepted" })
      .eq("id", order.id)
      .eq("status", "pending")
      .is("driver_id", null);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Order accepted");
    onAccepted();
  };
  return (
    <div className="card-soft p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{order.shop_name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{order.pickup_address}</p>
          <div className="mt-2 flex gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5"><Navigation className="h-3 w-3" />{order.distance_km.toFixed(1)} km</span>
            <span>{timeAgo(order.created_at)}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">You pay</p>
          <p className="text-lg font-black">{fmtINR(order.order_amount)}</p>
          <p className="mt-1 text-xs text-primary">+ {fmtINR(order.delivery_charge)} yours</p>
        </div>
      </div>
      <Button disabled={busy} onClick={accept} className="mt-4 h-10 w-full rounded-full font-semibold">
        {busy ? "Accepting…" : "Accept order"}
      </Button>
    </div>
  );
}

function ActiveOrder({ order, onChange }: { order: Order; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const paymentReceived = order.status === "payment_received" || order.status === "out_for_delivery" || order.status === "delivered";

  const update = async (patch: Partial<Order>) => {
    setBusy(true);
    const { error } = await supabase.from("orders").update(patch).eq("id", order.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    onChange();
  };

  return (
    <div className="card-elevated p-6">
      <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${ORDER_STATUS_TONE[order.status]}`}>
        {ORDER_STATUS_LABEL[order.status]}
      </span>
      <h3 className="mt-3 text-xl font-bold">{order.order_description}</h3>

      <div className="mt-5 space-y-4 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Pickup</p>
          <p className="mt-1 font-medium">{order.pickup_notes || "See shop for details"}</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pay the shop</span>
            <span className="font-semibold">{fmtINR(order.order_amount)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted-foreground">You collect from customer</span>
            <span className="font-semibold">{fmtINR(order.total_amount)}</span>
          </div>
          <div className="mt-1 flex justify-between text-primary">
            <span>Your earning</span>
            <span className="font-semibold">{fmtINR(order.delivery_charge)}</span>
          </div>
        </div>

        {paymentReceived ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs uppercase tracking-wider text-primary">Customer</p>
            <p className="mt-1 font-semibold">{order.customer_name}</p>
            <a href={`tel:${order.customer_phone}`} className="mt-1 inline-flex items-center gap-1.5 text-sm text-primary">
              <Phone className="h-3.5 w-3.5" /> {order.customer_phone}
            </a>
            <p className="mt-2 text-sm">{order.customer_address}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Customer details unlock after the shop confirms payment.
          </div>
        )}
      </div>

      <div className="mt-6 space-y-2">
        {order.status === "accepted" && (
          <Button disabled={busy} className="h-11 w-full rounded-full font-semibold" onClick={() => update({ status: "reached_shop" })}>
            I've reached the shop
          </Button>
        )}
        {order.status === "payment_received" && (
          <Button disabled={busy} className="h-11 w-full rounded-full font-semibold" onClick={() => update({ status: "out_for_delivery" })}>
            Start delivery
          </Button>
        )}
        {order.status === "out_for_delivery" && (
          <Button disabled={busy} className="h-11 w-full rounded-full font-semibold" onClick={() => update({ status: "delivered" })}>
            <Package className="mr-1.5 h-4 w-4" /> Mark delivered
          </Button>
        )}
      </div>
    </div>
  );
}

function LocationBlock({ state }: { state: "loading" | "denied" | "unavailable" }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
          <MapPin className="h-7 w-7" />
        </div>
        <h1 className="mt-6 text-2xl font-black">
          {state === "loading"
            ? "Locating you…"
            : state === "denied"
              ? "Location permission blocked"
              : "Location unavailable"}
        </h1>
        {state === "loading" ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Waiting for a GPS fix. Please allow the browser prompt if it appears — we'll continue automatically.
          </p>
        ) : state === "denied" ? (
          <p className="mt-3 text-sm text-muted-foreground">
            You've blocked location for this site. Tap the lock icon in your browser's address bar, set Location to Allow, then tap Try again.
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Your device can't share a location right now. Check that GPS / Location Services are on and try again.
          </p>
        )}
        {state !== "loading" && (
          <Button onClick={() => window.location.reload()} className="mt-6 rounded-full">
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
