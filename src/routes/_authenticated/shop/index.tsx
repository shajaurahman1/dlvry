import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Clock, CheckCircle2, PackageCheck, Settings, XCircle, Truck, CalendarDays } from "lucide-react";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, fmtINR, timeAgo } from "@/lib/orders";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/shop/")({ component: ShopDashboard });

type Order = Tables<"orders">;
type Shop = Tables<"shopkeepers">;
type Filter = "all" | "today" | "week" | "month" | "pending" | "active" | "completed" | "cancelled";

function ShopDashboard() {
  const { user, roles, loading } = useAuth();
  const navigate = useNavigate();
  const [shop, setShop] = useState<Shop | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [open, setOpen] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (loading) return;
    if (!roles.includes("shopkeeper") && !roles.includes("admin")) {
      navigate({ to: "/onboarding" });
    }
  }, [roles, loading, navigate]);

  const load = async () => {
    if (!user) return;
    const [{ data: s }, { data: o }] = await Promise.all([
      supabase.from("shopkeepers").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("orders").select("*").eq("shop_id", user.id).order("created_at", { ascending: false }),
    ]);
    setShop(s);
    setOrders(o ?? []);
    setDataLoading(false);
  };

  useEffect(() => {
    void load();
    if (!user) return;
    const ch = supabase
      .channel("shop-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `shop_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = orders.filter((o) => new Date(o.created_at) >= startOfDay);
    const month = orders.filter((o) => new Date(o.created_at) >= startOfMonth);
    const active = orders.filter((o) => !["delivered", "cancelled"].includes(o.status));
    const delivered = orders.filter((o) => o.status === "delivered");
    const cancelled = orders.filter((o) => o.status === "cancelled");
    return {
      today: today.length,
      month: month.length,
      total: orders.length,
      active: active.length,
      delivered: delivered.length,
      cancelled: cancelled.length,
    };
  }, [orders]);

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekAgo = now.getTime() - 7 * 86400_000;
    const monthAgo = now.getTime() - 30 * 86400_000;
    return orders.filter((o) => {
      const t = new Date(o.created_at).getTime();
      switch (filter) {
        case "today": return t >= startOfDay;
        case "week": return t >= weekAgo;
        case "month": return t >= monthAgo;
        case "pending": return o.status === "pending";
        case "active": return !["delivered", "cancelled", "pending"].includes(o.status);
        case "completed": return o.status === "delivered";
        case "cancelled": return o.status === "cancelled";
        default: return true;
      }
    });
  }, [orders, filter]);

  if (dataLoading) return <AppShell><Skeleton /></AppShell>;

  if (!shop) {
    return (
      <AppShell title="Complete your profile" subtitle="A moment more">
        <div className="card-soft p-8 text-center">
          <p className="text-sm text-muted-foreground">Finish setting up your shop to start dispatching orders.</p>
          <Button className="mt-4 rounded-full" onClick={() => navigate({ to: "/onboarding" })}>Set up shop</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      subtitle={shop.shop_name}
      title="Dispatch"
      actions={
        <Button variant="outline" size="icon" className="h-11 w-11 rounded-full" onClick={() => navigate({ to: "/shop/settings" })} aria-label="Edit shop">
          <Settings className="h-4 w-4" />
        </Button>
      }
    >
      {/* Shop header card */}
      <div className="card-elevated mb-6 flex items-center gap-4 p-5">
        {shop.shop_photo_url ? (
          <img src={shop.shop_photo_url} alt={shop.shop_name} className="h-14 w-14 rounded-2xl object-cover" />
        ) : (
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-lg font-black text-primary">
            {shop.shop_name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{shop.shop_name}</p>
          <p className="text-xs capitalize text-muted-foreground">{shop.shop_category}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
          shop.approval_status === "blocked" ? "bg-destructive/10 text-destructive" : "bg-primary/15 text-primary"
        }`}>
          {shop.approval_status === "blocked" ? "Blocked" : "Active"}
        </span>
      </div>

      {shop.approval_status === "blocked" && (
        <div className="mb-6 card-soft border-destructive/40 bg-destructive/10 p-4">
          <p className="text-sm font-medium">Your account has been blocked</p>
          <p className="mt-1 text-xs text-muted-foreground">Please contact support.</p>
        </div>
      )}

      {/* Big CTA */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            disabled={shop.approval_status === "blocked"}
            className="mb-8 h-16 w-full rounded-2xl text-base font-bold shadow-soft"
          >
            <Plus className="mr-2 h-5 w-5" /> NEW ORDER REQUEST
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New order request</DialogTitle></DialogHeader>
          <NewOrderForm shop={shop} onCreated={() => { setOpen(false); load(); }} />
        </DialogContent>
      </Dialog>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Today" value={stats.today} icon={<CalendarDays className="h-4 w-4" />} />
        <Stat label="This month" value={stats.month} icon={<CalendarDays className="h-4 w-4" />} />
        <Stat label="All-time" value={stats.total} icon={<PackageCheck className="h-4 w-4" />} />
        <Stat label="Active" value={stats.active} icon={<Clock className="h-4 w-4" />} accent />
        <Stat label="Delivered" value={stats.delivered} icon={<Truck className="h-4 w-4" />} />
        <Stat label="Cancelled" value={stats.cancelled} icon={<XCircle className="h-4 w-4" />} />
      </div>

      <h2 className="mt-10 mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Orders</h2>
      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mb-4">
        <TabsList className="flex w-full flex-wrap gap-1 rounded-full bg-muted p-1">
          {(["all","today","week","month","pending","active","completed","cancelled"] as Filter[]).map((f) => (
            <TabsTrigger key={f} value={f} className="flex-1 rounded-full text-xs capitalize">{f}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="card-soft p-10 text-center">
          <p className="font-serif-italic text-muted-foreground">No orders in this view.</p>
          <p className="mt-2 text-sm text-muted-foreground">When a customer calls, tap REQUEST PICKUP.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => <ShopOrderCard key={o.id} order={o} onChange={load} />)}
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: React.ReactNode; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`card-soft p-4 ${accent ? "ring-1 ring-primary/25" : ""}`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function ShopOrderCard({ order, onChange }: { order: Order; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const update = async (patch: Partial<Order>) => {
    setBusy(true);
    const { error } = await supabase.from("orders").update(patch).eq("id", order.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    onChange();
  };

  const nextAction = (() => {
    if (order.status === "reached_shop") return { label: "Mark Payment Received", patch: { status: "payment_received" as const } };
    if (order.status === "pending") return { label: "Cancel order", patch: { status: "cancelled" as const, cancel_reason: "Cancelled by shop" }, danger: true };
    return null;
  })();

  return (
    <div className="card-soft p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{order.order_description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {order.customer_name} · <a href={`tel:${order.customer_phone}`} className="underline-offset-2 hover:underline">{order.customer_phone}</a>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{timeAgo(order.created_at)}</p>
        </div>
        <div className="text-right">
          <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${ORDER_STATUS_TONE[order.status]}`}>
            {ORDER_STATUS_LABEL[order.status]}
          </span>
          <p className="mt-2 text-lg font-black">{fmtINR(order.total_amount)}</p>
          <p className="text-[11px] text-muted-foreground">Order {fmtINR(order.order_amount)} + Delivery {fmtINR(order.delivery_charge)}</p>
        </div>
      </div>
      {nextAction && (
        <Button
          disabled={busy}
          variant={nextAction.danger ? "outline" : "default"}
          onClick={() => update(nextAction.patch)}
          className="mt-4 h-10 w-full rounded-full text-sm font-semibold"
        >
          {nextAction.label}
        </Button>
      )}
    </div>
  );
}

function NewOrderForm({ shop, onCreated }: { shop: Shop; onCreated: () => void }) {
  const [f, setF] = useState({
    customer_name: "", customer_phone: "", customer_address: "",
    order_description: "", order_amount: "", delivery_charge: "30", pickup_notes: "",
  });
  const [busy, setBusy] = useState(false);
  const total = (Number(f.order_amount) || 0) + (Number(f.delivery_charge) || 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.customer_name || !f.customer_phone || !f.customer_address || !f.order_description) return toast.error("Fill all required fields");
    setBusy(true);
    const { error } = await supabase.from("orders").insert({
      shop_id: shop.id,
      customer_name: f.customer_name,
      customer_phone: f.customer_phone,
      customer_address: f.customer_address,
      order_description: f.order_description,
      order_amount: Number(f.order_amount) || 0,
      delivery_charge: Number(f.delivery_charge) || 0,
      pickup_notes: f.pickup_notes,
      pickup_lat: shop.latitude,
      pickup_lng: shop.longitude,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Request sent to nearby drivers");
    onCreated();
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Customer name"><Input value={f.customer_name} onChange={(e) => setF({ ...f, customer_name: e.target.value })} required /></FormField>
        <FormField label="Customer phone"><Input value={f.customer_phone} onChange={(e) => setF({ ...f, customer_phone: e.target.value })} required /></FormField>
      </div>
      <FormField label="Delivery address"><Textarea rows={2} value={f.customer_address} onChange={(e) => setF({ ...f, customer_address: e.target.value })} required /></FormField>
      <FormField label="Order description"><Textarea rows={2} value={f.order_description} onChange={(e) => setF({ ...f, order_description: e.target.value })} required /></FormField>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Order amount (₹)"><Input type="number" min="0" value={f.order_amount} onChange={(e) => setF({ ...f, order_amount: e.target.value })} required /></FormField>
        <FormField label="Delivery charge (₹)"><Input type="number" min="0" value={f.delivery_charge} onChange={(e) => setF({ ...f, delivery_charge: e.target.value })} required /></FormField>
      </div>
      <div className="rounded-2xl bg-primary/5 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total customer pays</span>
          <span className="text-xl font-black text-primary">{fmtINR(total)}</span>
        </div>
      </div>
      <FormField label="Notes (optional)"><Input value={f.pickup_notes} onChange={(e) => setF({ ...f, pickup_notes: e.target.value })} placeholder="e.g. Ready in 10 min" /></FormField>
      <Button type="submit" disabled={busy} className="h-11 w-full rounded-full font-semibold">
        {busy ? "Creating…" : "Create pickup request"}
      </Button>
    </form>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Skeleton() {
  return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="card-soft h-20 animate-pulse" />)}</div>;
}
