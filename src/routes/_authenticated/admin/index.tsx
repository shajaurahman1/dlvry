import { pageHead } from "@/lib/metadata";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { listShopkeepers, setShopkeeperStatus } from "@/lib/shop.functions";
import { listDrivers, setDriverStatus as setDriverStatusFn } from "@/lib/driver.functions";
import { listAdminOrders } from "@/lib/orders.functions";
import { getSettings, updateSettings } from "@/lib/misc.functions";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, fmtINR, timeAgo } from "@/lib/orders";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({ head: () => pageHead("Administration", "Manage MOVEBY partners, verification and deliveries."), component: AdminDashboard });

type Shop = Awaited<ReturnType<typeof listShopkeepers>>[number] & {
  id: string; shop_name: string; shop_category: string; address: string; approval_status: string;
};
type Driver = Awaited<ReturnType<typeof listDrivers>>[number] & {
  id: string; vehicle_type: string; vehicle_number: string | null; home_address: string | null;
  approval_status: string; verification_status: string; available_cash: number; rating_avg: number;
  gov_id_url: string | null; selfie_url: string | null; licence_url: string | null; rc_url: string | null;
  insurance_url: string | null; puc_url: string | null;
};
type Order = Awaited<ReturnType<typeof listAdminOrders>>[number] & {
  id: string; order_description: string; customer_name: string; created_at: string; status: string; total_amount: number;
};

function AdminDashboard() {
  const { roles, loading } = useAuth();
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Shop[]>([]);
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
    const [s, d, o] = await Promise.all([listShopkeepers(), listDrivers(), listAdminOrders()]);
    setBusinesses((s ?? []) as unknown as Shop[]);
    setDrivers((d ?? []) as unknown as Driver[]);
    setOrders((o ?? []) as unknown as Order[]);
  };
  useEffect(() => {
    void load();
  }, []);

  const setShopStatus = async (id: string, status: "approved" | "rejected" | "suspended") => {
    try {
      await setShopkeeperStatus({ data: { id, approval_status: status } });
      toast.success("Updated");
      load();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update"));
    }
  };
  const setDriverStatus = async (id: string, status: "approved" | "rejected" | "suspended") => {
    try {
      await setDriverStatusFn({ data: { id, approval_status: status } });
      toast.success("Updated");
      load();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update"));
    }
  };
  const setVerification = async (
    id: string,
    status: "verified" | "active" | "rejected" | "resubmit",
  ) => {
    try {
      await setDriverStatusFn({ data: { id, verification_status: status } });
      toast.success(`Marked ${status}`);
      load();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update"));
    }
  };

  const pendingBusinesses = businesses.filter((s) => s.approval_status === "pending");
  const pendingDrivers = drivers.filter((d) => d.approval_status === "pending");
  const unverified = drivers.filter(
    (d) => d.verification_status === "pending" || d.verification_status === "resubmit",
  );

  return (
    <AppShell subtitle="Master Admin" title="Control room">
      <div className="mb-8 grid gap-3 md:grid-cols-4">
        <Stat
          label="Businesses"
          value={businesses.filter((s) => s.approval_status === "approved").length}
        />
        <Stat
          label="Drivers"
          value={drivers.filter((d) => d.approval_status === "approved").length}
        />
        <Stat label="Delivered" value={orders.filter((o) => o.status === "delivered").length} />
        <Stat
          label="Pending"
          value={pendingBusinesses.length + pendingDrivers.length + unverified.length}
          accent
        />
      </div>

      <Tabs defaultValue="approvals" className="w-full">
        <TabsList className="flex flex-wrap rounded-full bg-muted p-1">
          <TabsTrigger value="approvals" className="rounded-full">
            Approvals
          </TabsTrigger>
          <TabsTrigger value="verify" className="rounded-full">
            Verification
          </TabsTrigger>
          <TabsTrigger value="businesses" className="rounded-full">
            Businesses
          </TabsTrigger>
          <TabsTrigger value="drivers" className="rounded-full">
            Drivers
          </TabsTrigger>
          <TabsTrigger value="orders" className="rounded-full">
            Orders
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-full">
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="mt-6 space-y-6">
          <Section title="Pending businesses">
            {pendingBusinesses.length === 0 ? (
              <Empty>No pending businesses.</Empty>
            ) : (
              pendingBusinesses.map((s) => (
                <Row key={s.id} title={s.shop_name} subtitle={`${s.shop_category} · ${s.address}`}>
                  <ApprovalActions
                    onApprove={() => setShopStatus(s.id, "approved")}
                    onReject={() => setShopStatus(s.id, "rejected")}
                  />
                </Row>
              ))
            )}
          </Section>
          <Section title="Pending drivers">
            {pendingDrivers.length === 0 ? (
              <Empty>No pending drivers.</Empty>
            ) : (
              pendingDrivers.map((d) => (
                <Row
                  key={d.id}
                  title={`${d.vehicle_type} · cash cap ${fmtINR(d.available_cash)}`}
                  subtitle={d.home_address ?? ""}
                >
                  <ApprovalActions
                    onApprove={() => setDriverStatus(d.id, "approved")}
                    onReject={() => setDriverStatus(d.id, "rejected")}
                  />
                </Row>
              ))
            )}
          </Section>
        </TabsContent>

        <TabsContent value="verify" className="mt-6 space-y-2">
          {unverified.length === 0 ? (
            <Empty>Everyone is verified.</Empty>
          ) : (
            unverified.map((d) => (
              <div key={d.id} className="card-soft p-4">
                <p className="font-semibold capitalize">
                  {d.vehicle_type} · {d.vehicle_number ?? "no number"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {d.home_address} · Cash cap {fmtINR(d.available_cash)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {(
                    [
                      ["Gov ID", d.gov_id_url],
                      ["Selfie", d.selfie_url],
                      ["Licence", d.licence_url],
                      ["RC", d.rc_url],
                      ["Insurance", d.insurance_url],
                      ["PUC", d.puc_url],
                    ] as const
                  )
                    .filter(([, url]) => !!url)
                    .map(([label, url]) => (
                      <a
                        key={label}
                        href={url!}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-border px-3 py-1 hover:bg-muted"
                      >
                        {label}
                      </a>
                    ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setVerification(d.id, "rejected")}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setVerification(d.id, "resubmit")}
                  >
                    Ask to resubmit
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-full"
                    onClick={() => setVerification(d.id, "verified")}
                  >
                    Verify
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="businesses" className="mt-6 space-y-2">
          {businesses.map((s) => (
            <Row
              key={s.id}
              title={s.shop_name}
              subtitle={`${s.shop_category} · ${s.approval_status}`}
            >
              <SuspendToggle
                status={s.approval_status}
                onSuspend={() => setShopStatus(s.id, "suspended")}
                onApprove={() => setShopStatus(s.id, "approved")}
              />
            </Row>
          ))}
        </TabsContent>

        <TabsContent value="drivers" className="mt-6 space-y-2">
          {drivers.map((d) => (
            <Row
              key={d.id}
              title={`${d.vehicle_type} · ${d.approval_status}`}
              subtitle={`Cash cap ${fmtINR(d.available_cash)} · ${d.rating_avg}★`}
            >
              <SuspendToggle
                status={d.approval_status}
                onSuspend={() => setDriverStatus(d.id, "suspended")}
                onApprove={() => setDriverStatus(d.id, "approved")}
              />
            </Row>
          ))}
        </TabsContent>

        <TabsContent value="orders" className="mt-6 space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="card-soft flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{o.order_description}</p>
                <p className="text-xs text-muted-foreground">
                  {o.customer_name} · {timeAgo(o.created_at)}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ORDER_STATUS_TONE[o.status]}`}
                >
                  {ORDER_STATUS_LABEL[o.status]}
                </span>
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
  const [latestVersion, setLatestVersion] = useState("0");
  const [updateMessage, setUpdateMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getSettings().then((data) => {
      if (!data) return;
      setRadius(String(data.delivery_radius_km));
      setExpiry(String(data.request_expiry_minutes));
      setSupport((data.support_number as string | null) ?? "");
      setLatestVersion(String(data.latest_version_code ?? 0));
      setUpdateMessage((data.update_message as string | null) ?? "");
    });
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await updateSettings({
        data: {
          delivery_radius_km: Number(radius) || 3,
          request_expiry_minutes: Number(expiry) || 10,
          support_number: support || undefined,
          latest_version_code: Number(latestVersion) || 0,
          update_message: updateMessage || undefined,
        },
      });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save settings"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-soft space-y-4 p-6">
      <div>
        <label className="text-sm font-medium">Delivery radius (km)</label>
        <Input
          type="number"
          min="0.5"
          step="0.5"
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          className="mt-1.5"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Only partners inside this radius see a shop's request.
        </p>
      </div>
      <div>
        <label className="text-sm font-medium">Request expiry (minutes)</label>
        <Input
          type="number"
          min="1"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          className="mt-1.5"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Support number</label>
        <Input
          value={support}
          onChange={(e) => setSupport(e.target.value)}
          placeholder="+91…"
          className="mt-1.5"
        />
      </div>
      <div className="border-t border-border pt-4">
        <label className="text-sm font-medium">Latest app version code</label>
        <Input
          type="number"
          min="0"
          value={latestVersion}
          onChange={(e) => setLatestVersion(e.target.value)}
          className="mt-1.5"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Set this to the versionCode you just published on Play Console. Anyone on an older
          build gets an "update available" banner with a Play Store link. Leave at 0 to never
          prompt.
        </p>
      </div>
      <div>
        <label className="text-sm font-medium">Update message (optional)</label>
        <Input
          value={updateMessage}
          onChange={(e) => setUpdateMessage(e.target.value)}
          placeholder="A new version of MOVEBY is available."
          className="mt-1.5"
        />
      </div>
      <Button disabled={busy} onClick={save} className="h-11 w-full rounded-full font-semibold">
        {busy ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
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
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Row({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-soft flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="truncate font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}
function ApprovalActions({ onApprove, onReject }: { onApprove: () => void; onReject: () => void }) {
  return (
    <>
      <Button size="sm" variant="outline" className="rounded-full" onClick={onReject}>
        Reject
      </Button>
      <Button size="sm" className="rounded-full" onClick={onApprove}>
        Approve
      </Button>
    </>
  );
}
function SuspendToggle({
  status,
  onSuspend,
  onApprove,
}: {
  status: string;
  onSuspend: () => void;
  onApprove: () => void;
}) {
  return status === "suspended" ? (
    <Button size="sm" className="rounded-full" onClick={onApprove}>
      Reinstate
    </Button>
  ) : (
    <Button size="sm" variant="outline" className="rounded-full" onClick={onSuspend}>
      Suspend
    </Button>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
