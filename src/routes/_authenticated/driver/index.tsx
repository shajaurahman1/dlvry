import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useLiveLocation } from "@/lib/geo";
import {
  MapPin,
  Navigation,
  Phone,
  Package,
  Wallet,
  TrendingUp,
  CheckCircle2,
  XCircle,
  ShieldCheck,
} from "lucide-react";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, fmtINR, timeAgo, minutesLeft } from "@/lib/orders";
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
  payment_method: string;
  expires_at: string | null;
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

  useEffect(() => {
    void loadDriver();
  }, [loadDriver]);

  useEffect(() => {
    if (loc.status !== "granted" || !loc.coords || !user) return;
    void supabase
      .from("drivers")
      .update({
        current_lat: loc.coords.lat,
        current_lng: loc.coords.lng,
        location_updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
  }, [loc, user]);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    void supabase.rpc("expire_stale_orders");
    const [{ data: rpc }, { data: mine }, { data: hist }] = await Promise.all([
      loc.status === "granted" && loc.coords
        ? supabase.rpc("nearby_orders", { driver_lat: loc.coords.lat, driver_lng: loc.coords.lng })
        : Promise.resolve({ data: [] as NearbyOrder[] }),
      supabase
        .from("orders")
        .select("*")
        .eq("driver_id", user.id)
        .not("status", "in", "(delivered,cancelled)")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("orders")
        .select("*")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setNearby((rpc as NearbyOrder[]) ?? []);
    setActive((mine?.[0] as Order) ?? null);
    setHistory((hist as Order[]) ?? []);
  }, [user, loc]);

  const prevNearbyIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    void loadOrders();
    if (!user) return;
    const ch = supabase
      .channel("driver-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadOrders())
      .subscribe();
    const iv = setInterval(loadOrders, 15000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(iv);
    };
  }, [loadOrders, user]);

  // Uber-style ping when a new order pops into your 3 km radius.
  useEffect(() => {
    const currentIds = new Set(nearby.map((n) => n.id));
    const fresh = nearby.filter((n) => !prevNearbyIdsRef.current.has(n.id));
    if (prevNearbyIdsRef.current.size > 0 && fresh.length > 0 && !active) {
      const top = fresh[0];
      toast.success(`New pickup ${top.distance_km.toFixed(1)} km away`, {
        description: `${top.shop_name} · ${fmtINR(top.total_amount)}`,
      });
      try {
        // Short chirp — best-effort, silent on browsers that block autoplay.
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AC();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.05;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        setTimeout(() => {
          osc.stop();
          ctx.close();
        }, 220);
      } catch {
        /* ignore */
      }
    }
    prevNearbyIdsRef.current = currentIds;
  }, [nearby, active]);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekAgo = now.getTime() - 7 * 86400_000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const delivered = history.filter((o) => o.status === "delivered");
    const cancelled = history.filter((o) => o.status === "cancelled");
    const sum = (arr: Order[]) => arr.reduce((s, o) => s + Number(o.delivery_charge || 0), 0);
    const inRange = (ts: number, from: number) => ts >= from;
    const todayDel = delivered.filter((o) =>
      inRange(new Date(o.delivered_at || o.created_at).getTime(), startOfDay),
    );
    const weekDel = delivered.filter((o) =>
      inRange(new Date(o.delivered_at || o.created_at).getTime(), weekAgo),
    );
    const monthDel = delivered.filter((o) =>
      inRange(new Date(o.delivered_at || o.created_at).getTime(), startOfMonth),
    );
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

  if (loc.status !== "granted" || !loc.coords)
    return <LocationBlock state={loc.status} onRetry={loc.retry} />;
  const coords = loc.coords;

  if (!driver) {
    return (
      <AppShell title="Complete your profile">
        <div className="card-soft p-8 text-center">
          <Button className="rounded-full" onClick={() => navigate({ to: "/onboarding" })}>
            Set up profile
          </Button>
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

      {driver.verification_status === "pending" && (
        <div className="card-soft mb-6 border-warning/40 bg-warning/10 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4" /> Verification pending
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            An admin is reviewing your documents. You'll start receiving requests as soon as you're
            verified.
          </p>
        </div>
      )}
      {driver.verification_status === "rejected" && (
        <div className="card-soft mb-6 border-destructive/40 bg-destructive/10 p-4">
          <p className="text-sm font-medium">Verification rejected</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {driver.verification_notes || "Please re-upload your documents from your profile."}
          </p>
        </div>
      )}

      {/* Availability */}
      <div className="card-elevated mb-6 flex items-center gap-4 p-5">
        <div
          className={`grid h-11 w-11 place-items-center rounded-full ${driver.is_online ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
        >
          <MapPin className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">
            {driver.is_busy
              ? "Busy — on a delivery"
              : driver.is_online
                ? "Online — receiving requests"
                : "Offline"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)} · Cash cap{" "}
            {fmtINR(driver.available_cash)}
          </p>
        </div>
        <Switch
          checked={driver.is_online}
          aria-label="Go online"
          onCheckedChange={async (on) => {
            setDriver({ ...driver, is_online: on });
            const { error } = await supabase
              .from("drivers")
              .update({ is_online: on })
              .eq("id", driver.id);
            if (error) {
              setDriver({ ...driver, is_online: !on });
              return toast.error(error.message);
            }
            toast.success(on ? "You're online" : "You're offline");
            void loadOrders();
          }}
        />
      </div>

      {/* Earnings */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Today"
          value={fmtINR(stats.todayEarn)}
          icon={<Wallet className="h-4 w-4" />}
          accent
        />
        <Stat
          label="This week"
          value={fmtINR(stats.weekEarn)}
          icon={<Wallet className="h-4 w-4" />}
        />
        <Stat
          label="This month"
          value={fmtINR(stats.monthEarn)}
          icon={<Wallet className="h-4 w-4" />}
        />
        <Stat
          label="Lifetime"
          value={fmtINR(stats.lifetimeEarn)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Today deliveries"
          value={stats.todayDeliveries}
          icon={<Package className="h-4 w-4" />}
        />
        <Stat
          label="Completed"
          value={stats.delivered}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <Stat label="Cancelled" value={stats.cancelled} icon={<XCircle className="h-4 w-4" />} />
        <Stat
          label="Accept rate"
          value={`${stats.acceptRate}%`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      <div className="mt-8">
        {active ? (
          <ActiveOrder order={active} onChange={loadOrders} />
        ) : (
          <>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Available requests
            </h2>
            {nearby.length === 0 ? (
              <div className="card-soft p-10 text-center">
                <p className="font-serif-italic text-muted-foreground">
                  {driver.is_online ? "No orders nearby." : "You're offline."}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {driver.is_online
                    ? "We only show orders within 3 km of your live location."
                    : "Go online to start receiving pickup requests near you."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {nearby.map((o) => (
                  <NearbyCard key={o.id} order={o} onAccepted={loadOrders} coords={coords} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent deliveries
          </h2>
          <div className="space-y-2">
            {history.slice(0, 8).map((o) => (
              <div key={o.id} className="card-soft flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{o.order_description}</p>
                  <p className="text-[11px] text-muted-foreground">{timeAgo(o.created_at)}</p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${ORDER_STATUS_TONE[o.status]}`}
                  >
                    {ORDER_STATUS_LABEL[o.status]}
                  </span>
                  <p className="mt-1 text-sm font-bold text-primary">
                    +{fmtINR(o.delivery_charge)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Stat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`card-soft p-4 ${accent ? "ring-1 ring-primary/25" : ""}`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
}

function NearbyCard({
  order,
  onAccepted,
  coords,
}: {
  order: NearbyOrder;
  onAccepted: () => void;
  coords: { lat: number; lng: number };
}) {
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("accept_order", {
      p_order_id: order.id,
      p_lat: coords.lat,
      p_lng: coords.lng,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    const res = data as { ok: boolean; error?: string };
    if (!res?.ok) {
      const msg: Record<string, string> = {
        already_taken: "Another delivery partner accepted this first.",
        expired: "This request has expired.",
        too_far: "You've moved out of range for this pickup.",
        not_verified: "Your account is still awaiting verification.",
        busy: "Finish your current delivery first.",
      };
      toast.error(msg[res?.error ?? ""] ?? "Could not accept this order.");
      onAccepted();
      return;
    }
    toast.success("Order accepted");
    onAccepted();
  };
  const mins = minutesLeft(order.expires_at);
  return (
    <div className="card-soft p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{order.shop_name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{order.pickup_address}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5">
              <Navigation className="h-3 w-3" />
              {order.distance_km.toFixed(1)} km
            </span>
            <span className="rounded-full bg-accent px-2 py-0.5 uppercase">
              {order.payment_method}
            </span>
            {mins !== null && (
              <span className="rounded-full bg-accent px-2 py-0.5">expires in {mins}m</span>
            )}
            <span>{timeAgo(order.created_at)}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">You pay</p>
          <p className="text-lg font-black">{fmtINR(order.order_amount)}</p>
          <p className="mt-1 text-xs text-primary">+ {fmtINR(order.delivery_charge)} yours</p>
        </div>
      </div>
      <Button
        disabled={busy}
        onClick={accept}
        className="mt-4 h-10 w-full rounded-full font-semibold"
      >
        {busy ? "Accepting…" : "Accept order"}
      </Button>
    </div>
  );
}

function ActiveOrder({ order, onChange }: { order: Order; onChange: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState("");
  const [shop, setShop] = useState<{
    shop_name: string;
    address: string;
    phone: string | null;
  } | null>(null);
  const [driverName, setDriverName] = useState<string>("");
  const paymentReceived = [
    "payment_received",
    "picked_up",
    "going_to_customer",
    "out_for_delivery",
    "arrived_at_customer",
    "delivered",
  ].includes(order.status);

  useEffect(() => {
    void supabase
      .from("shopkeepers")
      .select("shop_name,address,shop_phone")
      .eq("id", order.shop_id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) return;
        const { data: prof } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", order.shop_id)
          .maybeSingle();
        setShop({
          shop_name: data.shop_name,
          address: data.address,
          phone: data.shop_phone ?? prof?.phone ?? null,
        });
      });
    if (user) {
      void supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => setDriverName(data?.full_name ?? "Delivery partner"));
    }
  }, [order.shop_id, user]);

  const advance = async (status: string, code?: string) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("advance_order", {
      p_order_id: order.id,
      p_status: status as Order["status"],
      p_otp: code ?? undefined,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    const res = data as { ok: boolean; error?: string };
    if (!res?.ok) {
      return toast.error(
        res?.error === "bad_otp"
          ? "That delivery code doesn't match. Ask the shop for the code."
          : "Could not update the order.",
      );
    }
    onChange();
  };

  const openWhatsAppCustomer = () => {
    const msg = `Hi ${order.customer_name},

This is ${driverName || "your delivery partner"} from ${shop?.shop_name ?? "the shop"}.
I have picked up your order worth ₹${Number(order.order_amount)}.
I will deliver it shortly.

Delivery Charge: ₹${Number(order.delivery_charge)}
Total Payable: ₹${Number(order.total_amount)}

Thank you.`;
    const phone = (order.customer_phone || "").replace(/[^\d]/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const navigateTo = (lat: number | null, lng: number | null, fallback?: string) => {
    const dest = lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(fallback ?? "");
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, "_blank");
  };

  // Which step comes next for this driver.
  const step = (() => {
    switch (order.status) {
      case "accepted":
        return { status: "going_to_shop", label: "Start — going to shop" };
      case "going_to_shop":
        return { status: "arrived_at_shop", label: "I've arrived at the shop" };
      case "arrived_at_shop":
      case "reached_shop":
        return null; // waiting for shop to confirm payment
      case "payment_received":
        return { status: "picked_up", label: "Order picked up" };
      case "picked_up":
        return { status: "going_to_customer", label: "Going to customer" };
      case "going_to_customer":
      case "out_for_delivery":
        return { status: "arrived_at_customer", label: "Arrived at customer" };
      default:
        return null;
    }
  })();

  return (
    <div className="card-elevated p-6">
      <span
        className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${ORDER_STATUS_TONE[order.status]}`}
      >
        {ORDER_STATUS_LABEL[order.status]}
      </span>
      <h3 className="mt-3 text-xl font-bold">{order.order_description}</h3>

      <div className="mt-5 space-y-4 text-sm">
        {shop && (
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Shop</p>
            <p className="mt-1 font-semibold">{shop.shop_name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{shop.address}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {shop.phone && (
                <a
                  href={`tel:${shop.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium"
                >
                  <Phone className="h-3.5 w-3.5" /> Contact shop
                </a>
              )}
              <button
                onClick={() => navigateTo(order.pickup_lat, order.pickup_lng)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium"
              >
                <Navigation className="h-3.5 w-3.5" /> Navigate to shop
              </button>
            </div>
          </div>
        )}

        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Pickup notes</p>
          <p className="mt-1 font-medium">{order.pickup_notes || "See shop for details"}</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pay the shop ({order.payment_method})</span>
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
            <a
              href={`tel:${order.customer_phone}`}
              className="mt-1 inline-flex items-center gap-1.5 text-sm text-primary"
            >
              <Phone className="h-3.5 w-3.5" /> {order.customer_phone}
            </a>
            <p className="mt-2 text-sm">{order.customer_address}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() =>
                  navigateTo(order.customer_lat, order.customer_lng, order.customer_address)
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium"
              >
                <Navigation className="h-3.5 w-3.5" /> Navigate to customer
              </button>
              <button
                onClick={openWhatsAppCustomer}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium"
              >
                <Package className="h-3.5 w-3.5" /> WhatsApp customer
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Customer details unlock after the shop confirms payment.
          </div>
        )}
      </div>

      <div className="mt-6 space-y-2">
        {(order.status === "arrived_at_shop" || order.status === "reached_shop") && (
          <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Waiting for the shop to confirm your payment.
          </div>
        )}
        {step && (
          <Button
            disabled={busy}
            className="h-11 w-full rounded-full font-semibold"
            onClick={() => advance(step.status)}
          >
            {step.label}
          </Button>
        )}
        {order.status === "arrived_at_customer" && (
          <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs text-muted-foreground">
              Ask the customer for the 4-digit delivery code shared with the shop.
            </p>
            <div className="flex gap-2">
              <Input
                inputMode="numeric"
                maxLength={4}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="0000"
                className="text-center text-lg font-bold tracking-[0.4em]"
              />
              <Button
                disabled={busy || otp.length !== 4}
                className="rounded-full font-semibold"
                onClick={() => advance("delivered", otp)}
              >
                Complete
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

