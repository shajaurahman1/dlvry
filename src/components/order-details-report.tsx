import { X, FileText } from "lucide-react";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, fmtCurrency, fmtDateTime } from "@/lib/orders";

export interface OrderReportData {
  id: string;
  status: string;
  created_at: string;
  accepted_at?: string | null;
  reached_shop_at?: string | null;
  payment_received_at?: string | null;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  order_description?: string | null;
  pickup_notes?: string | null;
  order_amount: number;
  delivery_charge: number;
  total_amount?: number | null;
  payment_method: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  shop_name?: string | null;
  shop_phone?: string | null;
  shop_address?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
}

/** Full-screen record of one order — every detail in one place, in case a
 *  shop, driver, or customer dispute ever needs pointing back to exactly
 *  what happened and when. Nothing here is ever deleted by "Clear history"
 *  (that only hides old rows from the list view); this is just the one
 *  place to actually read it back. */
export function OrderDetailsReport({
  order,
  currency,
  onClose,
}: {
  order: OrderReportData;
  currency?: string | null;
  onClose: () => void;
}) {
  const total = order.total_amount ?? order.order_amount + order.delivery_charge;

  const timeline = (
    [
      ["Order created", order.created_at],
      ["Delivery partner accepted", order.accepted_at],
      ["Reached shop", order.reached_shop_at],
      ["Payment received", order.payment_received_at],
      ["Picked up", order.picked_up_at],
      ["Delivered", order.delivered_at],
      ["Cancelled", order.cancelled_at],
    ] as const
  ).filter(([, at]) => !!at);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Order report
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[11px] text-muted-foreground">{order.id}</p>
              <p className="mt-1 truncate text-lg font-bold">
                {order.order_description || "Delivery order"}
              </p>
            </div>
            <span
              className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${ORDER_STATUS_TONE[order.status]}`}
            >
              {ORDER_STATUS_LABEL[order.status]}
            </span>
          </div>

          <ReportSection title="Amount">
            <ReportRow label="Order amount" value={fmtCurrency(order.order_amount, currency)} />
            <ReportRow
              label="Delivery charge"
              value={fmtCurrency(order.delivery_charge, currency)}
            />
            <ReportRow label="Total" value={fmtCurrency(total, currency)} strong />
            <ReportRow label="Payment method" value={order.payment_method.toUpperCase()} />
          </ReportSection>

          <ReportSection title="Shop">
            <ReportRow label="Name" value={order.shop_name || "—"} />
            <ReportRow label="Phone" value={order.shop_phone || "—"} />
            <ReportRow label="Address" value={order.shop_address || "—"} />
          </ReportSection>

          <ReportSection title="Customer">
            <ReportRow label="Name" value={order.customer_name} />
            <ReportRow label="Phone" value={order.customer_phone} />
            <ReportRow label="Address" value={order.customer_address} />
          </ReportSection>

          {(order.driver_name || order.driver_phone) && (
            <ReportSection title="Delivery partner">
              <ReportRow label="Name" value={order.driver_name || "—"} />
              <ReportRow label="Phone" value={order.driver_phone || "—"} />
            </ReportSection>
          )}

          {order.pickup_notes && (
            <ReportSection title="Pickup notes">
              <p className="text-sm">{order.pickup_notes}</p>
            </ReportSection>
          )}

          {order.cancel_reason && (
            <ReportSection title="Cancellation reason">
              <p className="text-sm">{order.cancel_reason}</p>
            </ReportSection>
          )}

          <ReportSection title="Timeline">
            <div className="space-y-2">
              {timeline.map(([label, at]) => (
                <div key={label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-right font-medium">{fmtDateTime(at)}</span>
                </div>
              ))}
            </div>
          </ReportSection>
        </div>
      </div>
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="rounded-xl bg-muted/40 p-4">{children}</div>
    </div>
  );
}

function ReportRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-sm first:pt-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right ${strong ? "font-bold" : "font-medium"}`}>{value}</span>
    </div>
  );
}
