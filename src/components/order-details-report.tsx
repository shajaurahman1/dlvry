import { X, FileText } from "lucide-react";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  fmtCurrency,
  fmtDate,
  fmtDateTime,
  fmtTime,
} from "@/lib/orders";

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

/** Everything about one order on a single screen, for a screenshot you can
 *  hand someone whole. The order's date is shown once, up top — each
 *  timeline step below only repeats it if that step actually fell on a
 *  different day; otherwise it's just the time, which is the part that
 *  actually changes. Nothing here is ever deleted by "Clear history"
 *  (that only hides old rows from the list view); this is just the one
 *  place to read it back. */
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
  const orderDay = new Date(order.created_at).toDateString();

  const timeline = (
    [
      ["Created", order.created_at],
      ["Accepted", order.accepted_at],
      ["Reached shop", order.reached_shop_at],
      ["Paid shop", order.payment_received_at],
      ["Picked up", order.picked_up_at],
      ["Delivered", order.delivered_at],
      ["Cancelled", order.cancelled_at],
    ] as const
  ).filter(([, at]) => !!at);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 p-3 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="card-elevated max-h-[95vh] w-full max-w-xl overflow-y-auto p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Order report
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] text-muted-foreground">{order.id}</p>
              <p className="mt-0.5 truncate text-base font-bold">
                {order.order_description || "Delivery order"}
              </p>
              <p className="text-[11px] text-muted-foreground">{fmtDate(order.created_at)}</p>
            </div>
            <span
              className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${ORDER_STATUS_TONE[order.status]}`}
            >
              {ORDER_STATUS_LABEL[order.status]}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ReportSection title="Amount">
              <ReportRow label="Order" value={fmtCurrency(order.order_amount, currency)} />
              <ReportRow label="Delivery" value={fmtCurrency(order.delivery_charge, currency)} />
              <ReportRow label="Total" value={fmtCurrency(total, currency)} strong />
              <ReportRow label="Payment" value={order.payment_method.toUpperCase()} />
            </ReportSection>

            <ReportSection title="Shop">
              <ReportRow label="Name" value={order.shop_name || "—"} />
              <ReportRow label="Phone" value={order.shop_phone || "—"} />
              <ReportRow label="Address" value={order.shop_address || "—"} />
            </ReportSection>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
          </div>

          {(order.pickup_notes || order.cancel_reason) && (
            <div className="grid grid-cols-2 gap-3">
              {order.pickup_notes && (
                <ReportSection title="Pickup notes">
                  <p className="text-xs">{order.pickup_notes}</p>
                </ReportSection>
              )}
              {order.cancel_reason && (
                <ReportSection title="Cancellation reason">
                  <p className="text-xs">{order.cancel_reason}</p>
                </ReportSection>
              )}
            </div>
          )}

          <ReportSection title="Timeline">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {timeline.map(([label, at]) => {
                const sameDay = new Date(at as string).toDateString() === orderDay;
                return (
                  <div key={label} className="flex items-baseline gap-1.5 text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{sameDay ? fmtTime(at) : fmtDateTime(at)}</span>
                  </div>
                );
              })}
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
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="rounded-lg bg-muted/40 p-2.5">{children}</div>
    </div>
  );
}

function ReportRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2 py-0.5 text-xs first:pt-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right ${strong ? "font-bold" : "font-medium"}`}>{value}</span>
    </div>
  );
}
