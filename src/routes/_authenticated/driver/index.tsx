import { pageHead } from "@/lib/metadata";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { getMyDriver, setDriverLocation, setDriverOnline, setSearchRadius } from "@/lib/driver.functions";
import {
  getNearbyOrders,
  listDriverOrders,
  acceptOrder,
  advanceOrder,
  expireStaleOrders,
} from "@/lib/orders.functions";
import { RoleSwitchButton } from "@/components/role-switch-button";
import { AppShell } from "@/components/app-shell";
import { NotificationPromptCard } from "@/components/notification-prompt-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useLiveLocation } from "@/lib/geo";
import { LocationGate } from "@/components/location-gate";
import { errorMessage } from "@/lib/utils";
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

export const Route = createFileRoute("/_authenticated/driver/")({ head: () => pageHead("Delivery dashboard", "Find nearby pickups and manage your MOVEBY deliveries and earnings."), component: DriverDashboard });

type Driver = {
  id: string; is_online: number | boolean; is_busy: number | boolean; search_radius_km: number;
  available_cash: number; approval_status: string; verification_status: string; verification_notes: string | null;
};
type Order = {
  id: string; status: string; created_at: string; delivered_at: string | null; delivery_charge: number;
  order_amount: number; total_amount: number; order_description: string; shop_id: string;
  pickup_lat: number | null; pickup_lng: number | null; pickup_notes: string | null;
  customer_name: string; customer_phone: string; customer_address: string;
  customer_lat: number | null; customer_lng: number | null; payment_method: string;
  shop_name?: string; shop_phone?: string | null; shop_address?: string;
};

interface NearbyOrder {
  id: string;
  shop_id: string;
  shop_name: string;
  pickup_address: string;
  customer_address: string;
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
  const { user, roles, loading, profile } = useAuth();
  const firstName =
    typeof profile?.full_name === "string" && profile.full_name.trim()
      ? profile.full_name.trim().split(" ")[0]
      : null;
  const navigate = useNavigate();
  const loc = useLiveLocation(true);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [nearby, setNearby] = useState<NearbyOrder[]>([]);
  const [active, setActive] = useState<Order | null>(null);
  const [history, setHistory] = useState<Order[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (loading) return;
    if (!roles.includes("driver") && !roles.includes("admin")) navigate({ to: "/onboarding" });
  }, [roles, loading, navigate]);

  const loadDriver = useCallback(async () => {
    if (!user) return;
    const data = await getMyDriver();
    setDriver(data as Driver | null);
  }, [user]);

  useEffect(() => {
    void loadDriver();
  }, [loadDriver]);

  // Keep the latest fix in a ref so callbacks stay stable (no resubscribe loops).
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const locReady = loc.status === "granted" && !!loc.coords;
  const locLat = loc.coords?.lat;
  const locLng = loc.coords?.lng;
  if (loc.status === "granted" && loc.coords) coordsRef.current = loc.coords;

  const pushLocation = useCallback(async () => {
    const c = coordsRef.current;
    if (!c || !user) return;
    try {
      await setDriverLocation({ data: { lat: c.lat, lng: c.lng } });
    } catch (err) {
      console.error("[dlvry] failed to save driver location", err);
    }
  }, [user]);

  // Persist the driver's live position whenever it changes (rounded to ~10m).
  useEffect(() => {
    if (!locReady) return;
    void pushLocation();
  }, [locReady, locLat, locLng, pushLocation]);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    void expireStaleOrders().catch(() => {});
    const c = coordsRef.current;
    const [nearbyRes, mine] = await Promise.all([
      c ? getNearbyOrders({ data: { lat: c.lat, lng: c.lng } }) : Promise.resolve([]),
      listDriverOrders(),
    ]);
    setNearby(
      (nearbyRes as unknown as NearbyOrder[]).map((o) => ({
        ...o,
        pickup_address: (o as unknown as { shop_address?: string }).shop_address ?? "",
      })),
    );
    const mineOrders = mine as unknown as Order[];
    setActive(mineOrders.find((o) => o.status !== "delivered" && o.status !== "cancelled") ?? null);
    setHistory(mineOrders.slice(0, 50));
  }, [user]);

  const prevNearbyIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    void loadOrders();
    // No realtime push on Turso — poll is the source of truth.
    const iv = setInterval(() => {
      void pushLocation();
      void loadOrders();
    }, 10000);
    const onResume = () => {
      if (document.visibilityState === "visible") {
        void pushLocation();
        void loadOrders();
      }
    };
    document.addEventListener("visibilitychange", onResume);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onResume);
    };
  }, [loadOrders, pushLocation, user]);

  // Refetch as soon as we have (or move) a fix.
  useEffect(() => {
    if (!locReady) return;
    void loadOrders();
  }, [locReady, locLat, locLng, loadOrders]);

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
    setDismissed((prev) => {
      const next = new Set([...prev].filter((id) => currentIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [nearby, active]);

  const visibleNearby = useMemo(
    () => nearby.filter((o) => !dismissed.has(o.id)),
    [nearby, dismissed],
  );

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
    return <LocationGate state={loc.status} onRetry={loc.retry} />;
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
    <AppShell subtitle={firstName ? `Welcome back, ${firstName}` : "Live"} title="Delivery">
      <NotificationPromptCard />
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
          checked={Boolean(driver.is_online)}
          aria-label="Go online"
          onCheckedChange={async (on) => {
            setDriver({ ...driver, is_online: on });
            try {
              await setDriverOnline({ data: { isOnline: on } });
              toast.success(on ? "You're online" : "You're offline");
              if (on) await pushLocation();
              void loadOrders();
            } catch (err) {
              setDriver({ ...driver, is_online: !on });
              toast.error(errorMessage(err, "Failed to update"));
            }
          }}
        />
      </div>

      {/* Alert radius */}
      <div className="card-soft mb-6 flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="text-sm">
          <p className="font-semibold">Alert radius</p>
          <p className="text-xs text-muted-foreground">
            Only shops within {driver.search_radius_km} km of you will alert you.
          </p>
        </div>
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {[1, 2, 3].map((km) => (
            <button
              key={km}
              type="button"
              onClick={async () => {
                const prev = driver.search_radius_km;
                setDriver({ ...driver, search_radius_km: km });
                try {
                  await setSearchRadius({ data: { km } });
                  toast.success(`Alerts limited to ${km} km`);
                  void loadOrders();
                } catch (err) {
                  setDriver({ ...driver, search_radius_km: prev });
                  toast.error(errorMessage(err, "Failed to update"));
                }
              }}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                Number(driver.search_radius_km) === km
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground"
              }`}
            >
              {km} km
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap justify-end gap-2">
        <RoleSwitchButton targetRole="shopkeeper" />
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => navigate({ to: "/driver/settings" })}
        >
          Edit profile
        </Button>
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
            {visibleNearby.length === 0 ? (
              <div className="card-soft p-10 text-center">
                <p className="font-serif-italic text-muted-foreground">
                  {driver.is_online ? "No orders nearby." : "You're offline."}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {driver.is_online
                    ? `We only show orders within ${driver.search_radius_km} km of your live location.`
                    : "Go online to start receiving pickup requests near you."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleNearby.map((o) => (
                  <NearbyCard
                    key={o.id}
                    order={o}
                    onAccepted={loadOrders}
                    onDismiss={() => setDismissed((prev) => new Set(prev).add(o.id))}
                    coords={coords}
                  />
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
                  <p className="truncate text-sm font-semibold">{o.shop_name || o.order_description}</p>
                  {o.order_description && o.shop_name && (
                    <p className="truncate text-xs text-muted-foreground">{o.order_description}</p>
                  )}
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
  onDismiss,
  coords,
}: {
  order: NearbyOrder;
  onAccepted: () => void;
  onDismiss: () => void;
  coords: { lat: number; lng: number };
}) {
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    setBusy(true);
    try {
      await acceptOrder({ data: { orderId: order.id, lat: coords.lat, lng: coords.lng } });
      toast.success("Order accepted");
    } catch (err) {
      toast.error(errorMessage(err, "Could not accept this order."));
    } finally {
      setBusy(false);
      onAccepted();
    }
  };
  const mins = minutesLeft(order.expires_at);
  return (
    <div className="card-soft p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{order.shop_name}</p>
          <p className="mt-1 text-xs text-muted-foreground">Pickup: {order.pickup_address}</p>
          {order.customer_address && (
            <p className="mt-0.5 text-xs text-muted-foreground">Deliver to: {order.customer_address}</p>
          )}
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
      <div className="mt-4 flex gap-2">
        <Button
          disabled={busy}
          variant="outline"
          onClick={onDismiss}
          className="h-10 rounded-full font-semibold"
        >
          Not now
        </Button>
        <Button
          disabled={busy}
          onClick={accept}
          className="h-10 flex-1 rounded-full font-semibold"
        >
          {busy ? "Accepting…" : "Accept order"}
        </Button>
      </div>
    </div>
  );
}

function ActiveOrder({ order, onChange }: { order: Order; onChange: () => void }) {
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState("");
  const shop = order.shop_name
    ? { shop_name: order.shop_name, address: order.shop_address ?? "", phone: order.shop_phone ?? null }
    : null;
  const driverName = (profile?.full_name as string | undefined) || "Delivery partner";
  const paymentReceived = [
    "payment_received",
    "picked_up",
    "going_to_customer",
    "out_for_delivery",
    "arrived_at_customer",
    "delivered",
  ].includes(order.status);

  const advance = async (status: string, code?: string) => {
    setBusy(true);
    try {
      await advanceOrder({ data: { orderId: order.id, status, otp: code } });
      onChange();
    } catch (err) {
      toast.error(
        err instanceof Error && err.message.toLowerCase().includes("code")
          ? "That delivery code doesn't match. Ask the shop for the code."
          : errorMessage(err, "Could not update the order."),
      );
    } finally {
      setBusy(false);
    }
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
      <h3 className="mt-3 text-xl font-bold">{order.order_description || shop?.shop_name || "Delivery"}</h3>

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
