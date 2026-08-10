import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, fmtINR, timeAgo } from "@/lib/orders";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminDashboard });

type Shop = Tables<"shopkeepers">;
type Driver = Tables<"drivers">;
type Order = Tables<"orders">;

function AdminDashboard() {
  const { roles, loading } = useAuth();
  const navigate = useNavigate();
  const [shops, setShops] = useState<Shop[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!roles.includes("admin")) {
      toast.error("Access denied");
      navigate({ to: "/auth" });
    }
  }, [roles, loading, navigate]);

  const load = async () => {
    const [{ data: s }, { data: d }, { data: o }] = await Promise.all([
      supabase.from("shopkeepers").select("*").order("created_at", { ascending: false }),
      supabase.from("drivers").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setShops(s ?? []); setDrivers(d ?? []); setOrders(o ?? []);
  };
  useEffect(() => { void load(); }, []);

  const setShopStatus = async (id: string, status: "approved" | "rejected" | "suspended") => {
    const { error } = await supabase.from("shopkeepers").update({ approval_status: status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated"); load();
  };
  const setDriverStatus = async (id: string, status: "approved" | "rejected" | "suspended") => {
    const { error } = await supabase.from("drivers").update({ approval_status: status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated"); load();
  };
  const setVerification = async (id: string, status: "verified" | "active" | "rejected" | "resubmit") => {
    const { error } = await supabase.from("drivers").update({ verification_status: status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`); load();
  };

  const pendingShops = shops.filter((s) => s.approval_status === "pending");
  const pendingDrivers = drivers.filter((d) => d.approval_status === "pending");
  const unverified = drivers.filter((d) => d.verification_status === "pending" || d.verification_status === "resubmit");

  return (
    <AppShell subtitle="Master Admin" title="Control room">
      <div className="mb-8 grid gap-3 md:grid-cols-4">
        <Stat label="Shops" value={shops.filter((s) => s.approval_status === "approved").length} />
        <Stat label="Drivers" value={drivers.filter((d) => d.approval_status === "approved").length} />
        <Stat label="Delivered" value={orders.filter((o) => o.status === "delivered").length} />
        <Stat label="Pending" value={pendingShops.length + pendingDrivers.length + unverified.length} accent />
      </div>

      <Tabs defaultValue="approvals" className="w-full">
        <TabsList className="flex flex-wrap rounded-full bg-muted p-1">
          <TabsTrigger value="approvals" className="rounded-full">Approvals</TabsTrigger>
          <TabsTrigger value="verify" className="rounded-full">Verification</TabsTrigger>
          <TabsTrigger value="shops" className="rounded-full">Shops</TabsTrigger>
          <TabsTrigger value="drivers" className="rounded-full">Drivers</TabsTrigger>
          <TabsTrigger value="orders" className="rounded-full">Orders</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-full">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="mt-6 space-y-6">
          <Section title="Pending shops">
            {pendingShops.length === 0 ? <Empty>No pending shops.</Empty> :
              pendingShops.map((s) => (
                <Row key={s.id} title={s.shop_name} subtitle={`${s.shop_category} · ${s.address}`}>
                  <ApprovalActions onApprove={() => setShopStatus(s.id, "approved")} onReject={() => setShopStatus(s.id, "rejected")} />
                </Row>
              ))}
          </Section>
          <Section title="Pending drivers">
            {pendingDrivers.length === 0 ? <Empty>No pending drivers.</Empty> :
              pendingDrivers.map((d) => (
                <Row key={d.id} title={`${d.vehicle_type} · cash cap ${fmtINR(d.available_cash)}`} subtitle={d.home_address ?? ""}>
                  <ApprovalActions onApprove={() => setDriverStatus(d.id, "approved")} onReject={() => setDriverStatus(d.id, "rejected")} />
                </Row>
              ))}
          </Section>
        </TabsContent>

        <TabsContent value="verify" className="mt-6 space-y-2">
          {unverified.length === 0 ? <Empty>Everyone is verified.</Empty> : unverified.map((d) => (
            <div key={d.id} className="card-soft p-4">
              <p className="font-semibold capitalize">{d.vehicle_type} · {d.vehicle_number ?? "no number"}</p>
              <p className="text-xs text-muted-foreground">{d.home_address} · Cash cap {fmtINR(d.available_cash)}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {([["Gov ID", d.gov_id_url], ["Selfie", d.selfie_url], ["Licence", d.licence_url], ["RC", d.rc_url], ["Insurance", d.insurance_url], ["PUC", d.puc_url]] as const)
                  .filter(([, url]) => !!url)
                  .map(([label, url]) => (
                    <a key={label} href={url!} target="_blank" rel="noreferrer" className="rounded-full border border-border px-3 py-1 hover:bg-muted">{label}</a>
                  ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => setVerification(d.id, "rejected")}>Reject</Button>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => setVerification(d.id, "resubmit")}>Ask to resubmit</Button>
                <Button size="sm" className="rounded-full" onClick={() => setVerification(d.id, "verified")}>Verify</Button>
              </div>
            </div>
          ))}
        </TabsContent>


        <TabsContent value="shops" className="mt-6 space-y-2">
          {shops.map((s) => (
            <Row key={s.id} title={s.shop_name} subtitle={`${s.shop_category} · ${s.approval_status}`}>
              <SuspendToggle status={s.approval_status} onSuspend={() => setShopStatus(s.id, "suspended")} onApprove={() => setShopStatus(s.id, "approved")} />
            </Row>
          ))}
        </TabsContent>

        <TabsContent value="drivers" className="mt-6 space-y-2">
          {drivers.map((d) => (
            <Row key={d.id} title={`${d.vehicle_type} · ${d.approval_status}`} subtitle={`Cash cap ${fmtINR(d.available_cash)} · ${d.rating_avg}★`}>
              <SuspendToggle status={d.approval_status} onSuspend={() => setDriverStatus(d.id, "suspended")} onApprove={() => setDriverStatus(d.id, "approved")} />
            </Row>
          ))}
        </TabsContent>

        <TabsContent value="orders" className="mt-6 space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="card-soft flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{o.order_description}</p>
                <p className="text-xs text-muted-foreground">{o.customer_name} · {timeAgo(o.created_at)}</p>
              </div>
              <div className="text-right">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ORDER_STATUS_TONE[o.status]}`}>{ORDER_STATUS_LABEL[o.status]}</span>
                <p className="mt-1 text-sm font-bold">{fmtINR(o.total_amount)}</p>
              </div>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <SettingsPanel />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function SettingsPanel() {
  const [radius, setRadius] = useState("3");
  const [expiry, setExpiry] = useState("10");
  const [support, setSupport] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.from("app_settings").select("*").maybeSingle().then(({ data }) => {
      if (!data) return;
      setRadius(String(data.delivery_radius_km));
      setExpiry(String(data.request_expiry_minutes));
      setSupport(data.support_number ?? "");
    });
  }, []);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("app_settings").update({
      delivery_radius_km: Number(radius) || 3,
      request_expiry_minutes: Number(expiry) || 10,
      support_number: support || null,
    }).eq("id", true);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
  };

  return (
    <div className="card-soft space-y-4 p-6">
      <div>
        <label className="text-sm font-medium">Delivery radius (km)</label>
        <Input type="number" min="0.5" step="0.5" value={radius} onChange={(e) => setRadius(e.target.value)} className="mt-1.5" />
        <p className="mt-1 text-xs text-muted-foreground">Only partners inside this radius see a shop's request.</p>
      </div>
      <div>
        <label className="text-sm font-medium">Request expiry (minutes)</label>
        <Input type="number" min="1" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="mt-1.5" />
      </div>
      <div>
        <label className="text-sm font-medium">Support number</label>
        <Input value={support} onChange={(e) => setSupport(e.target.value)} placeholder="+91…" className="mt-1.5" />
      </div>
      <Button disabled={busy} onClick={save} className="h-11 w-full rounded-full font-semibold">{busy ? "Saving…" : "Save settings"}</Button>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`card-soft p-5 ${accent ? "border-primary/40" : ""}`}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-black ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Row({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="card-soft flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0"><p className="truncate font-semibold">{title}</p><p className="truncate text-xs text-muted-foreground">{subtitle}</p></div>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}
function ApprovalActions({ onApprove, onReject }: { onApprove: () => void; onReject: () => void }) {
  return (
    <>
      <Button size="sm" variant="outline" className="rounded-full" onClick={onReject}>Reject</Button>
      <Button size="sm" className="rounded-full" onClick={onApprove}>Approve</Button>
    </>
  );
}
function SuspendToggle({ status, onSuspend, onApprove }: { status: string; onSuspend: () => void; onApprove: () => void }) {
  return status === "suspended"
    ? <Button size="sm" className="rounded-full" onClick={onApprove}>Reinstate</Button>
    : <Button size="sm" variant="outline" className="rounded-full" onClick={onSuspend}>Suspend</Button>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
