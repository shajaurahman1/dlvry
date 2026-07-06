import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useLiveLocation } from "@/lib/geo";
import { MapPin, Navigation, Phone, Package, Wallet, TrendingUp, CheckCircle2, XCircle } from "lucide-react";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, fmtINR, timeAgo } from "@/lib/orders";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/driver/")({ component: DriverDashboard });

type Driver = Tables<"drivers">;
type Order = Tables<"orders">;

interface NearbyOrder {
  id: string; shop_id: string; shop_name: string; pickup_address: string;
  order_amount: number; delivery_charge: number; total_amount: number;
  pickup_lat: number; pickup_lng: number; distance_km: number; created_at: string;
}

function DriverDashboard() {
  const { user, roles, loading } = useAuth();
  const navigate = useNavigate();
  const loc = useLiveLocation(true);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [nearby, setNearby] = useState<NearbyOrder[]>([]);
  const [active, setActive] = useState<Order | null>(null);
  const [history, setHistory] = useState<Order[]>([]);

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

  useEffect(() => {
    if (loc.status !== "granted" || !user) return;
    void supabase.from("drivers").update({
      current_lat: loc.coords.lat,
      current_lng: loc.coords.lng,
      location_updated_at: new Date().toISOString(),
    }).eq("id", user.id);
  }, [loc, user]);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    const [{ data: rpc }, { data: mine }, { data: hist }] = await Promise.all([
      loc.status === "granted"
        ? supabase.rpc("nearby_orders", { driver_lat: loc.coords.lat, driver_lng: loc.coords.lng })
        : Promise.resolve({ data: [] as NearbyOrder[] }),
      supabase.from("orders").select("*").eq("driver_id", user.id).not("status", "in", "(delivered,cancelled)").order("created_at", { ascending: false }).limit(1),
      supabase.from("orders").select("*").eq("driver_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setNearby((rpc as NearbyOrder[]) ?? []);
    setActive((mine?.[0] as Order) ?? null);
    setHistory((hist as Order[]) ?? []);
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

  const stats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekAgo = now.getTime() - 7 * 86400_000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const delivered = history.filter((o) => o.status === "delivered");
    const cancelled = history.filter((o) => o.status === "cancelled");
    const sum = (arr: Order[]) => arr.reduce((s, o) => s + Number(o.delivery_charge || 0), 0);
    const inRange = (ts: number, from: number) => ts >= from;
    const todayDel = delivered.filter((o) => inRange(new Date(o.delivered_at || o.created_at).getTime(), startOfDay));
    const weekDel = delivered.filter((o) => inRange(new Date(o.delivered_at || o.created_at).getTime(), weekAgo));
    const monthDel = delivered.filter((o) => inRange(new Date(o.delivered_at || o.created_at).getTime(), startOfMonth));
    const total = delivered.length + cancelled.length;
    return {
      todayEarn: sum(todayDel),
      weekEarn: sum(weekDel),
      monthEarn: sum(monthDel),
      lifetimeEarn: sum(delivered),
      todayDeliveries: todayDel.length,
      delivered: delivered.length,
      cancelled: cancelled.length,
      acceptRate: total > 0 ? Math.round((delivered.length / total) * 100) : 100,
    };
  }, [history]);

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
      {driver.approval_status === "blocked" && (
        <div className="mb-6 card-soft border-destructive/40 bg-destructive/10 p-4">
          <p className="text-sm font-medium">Your account has been blocked</p>
          <p className="mt-1 text-xs text-muted-foreground">Please contact support.</p>
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

      {/* Earnings */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Today" value={fmtINR(stats.todayEarn)} icon={<Wallet className="h-4 w-4" />} accent />
        <Stat label="This week" value={fmtINR(stats.weekEarn)} icon={<Wallet className="h-4 w-4" />} />
        <Stat label="This month" value={fmtINR(stats.monthEarn)} icon={<Wallet className="h-4 w-4" />} />
        <Stat label="Lifetime" value={fmtINR(stats.lifetimeEarn)} icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Today deliveries" value={stats.todayDeliveries} icon={<Package className="h-4 w-4" />} />
        <Stat label="Completed" value={stats.delivered} icon={<CheckCircle2 className="h-4 w-4" />} />
        <Stat label="Cancelled" value={stats.cancelled} icon={<XCircle className="h-4 w-4" />} />
        <Stat label="Accept rate" value={`${stats.acceptRate}%`} icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      <div className="mt-8">
        {active ? (
          <ActiveOrder order={active} onChange={loadOrders} />
        ) : (
          <>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Available requests</h2>
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
      </div>

      {history.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent deliveries</h2>
          <div className="space-y-2">
            {history.slice(0, 8).map((o) => (
              <div key={o.id} className="card-soft flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{o.order_description}</p>
                  <p className="text-[11px] text-muted-foreground">{timeAgo(o.created_at)}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${ORDER_STATUS_TONE[o.status]}`}>
                    {ORDER_STATUS_LABEL[o.status]}
                  </span>
                  <p className="mt-1 text-sm font-bold text-primary">+{fmtINR(o.delivery_charge)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: React.ReactNode; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`card-soft p-4 ${accent ? "ring-1 ring-primary/25" : ""}`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
}

function NearbyCard({ order, onAccepted }: { order: NearbyOrder; onAccepted: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    if (!user) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("orders")
      .update({ driver_id: user.id, status: "accepted" })
      .eq("id", order.id)
      .eq("status", "pending")
      .is("driver_id", null)
      .select("id");
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data || data.length === 0) {
      toast.error("This order has already been accepted by another delivery partner.");
      onAccepted();
      return;
    }
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
          {state === "loading" ? "Locating you…" : state === "denied" ? "Location permission blocked" : "Location unavailable"}
        </h1>
        {state === "loading" ? (
          <p className="mt-3 text-sm text-muted-foreground">Waiting for a GPS fix. Please allow the browser prompt if it appears.</p>
        ) : state === "denied" ? (
          <p className="mt-3 text-sm text-muted-foreground">You've blocked location for this site. Tap the lock icon in your browser's address bar, set Location to Allow, then tap Try again.</p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Your device can't share a location right now. Check GPS and try again.</p>
        )}
        {state !== "loading" && (
          <Button onClick={() => window.location.reload()} className="mt-6 rounded-full">Try again</Button>
        )}
      </div>
    </div>
  );
}
