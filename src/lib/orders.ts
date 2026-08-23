export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Searching",
  searching: "Searching",
  accepted: "Accepted",
  going_to_shop: "Going to Shop",
  arrived_at_shop: "Arrived at Shop",
  reached_shop: "Reached Shop",
  payment_received: "Payment Received",
  picked_up: "Picked Up",
  going_to_customer: "Going to Customer",
  out_for_delivery: "Out for Delivery",
  arrived_at_customer: "Arrived at Customer",
  delivered: "Delivered",
  cancelled: "Cancelled",
  expired: "Expired",
  no_driver_found: "No Partner Found",
};

const ACTIVE_TONE = "bg-primary/10 text-primary";
const STRONG_TONE = "bg-primary/15 text-primary";

export const ORDER_STATUS_TONE: Record<string, string> = {
  pending: "bg-warning/15 text-[color:oklch(0.5_0.12_79)]",
  searching: "bg-warning/15 text-[color:oklch(0.5_0.12_79)]",
  accepted: ACTIVE_TONE,
  going_to_shop: ACTIVE_TONE,
  arrived_at_shop: ACTIVE_TONE,
  reached_shop: ACTIVE_TONE,
  payment_received: STRONG_TONE,
  picked_up: STRONG_TONE,
  going_to_customer: STRONG_TONE,
  out_for_delivery: STRONG_TONE,
  arrived_at_customer: STRONG_TONE,
  delivered: STRONG_TONE,
  cancelled: "bg-destructive/10 text-destructive",
  expired: "bg-destructive/10 text-destructive",
  no_driver_found: "bg-destructive/10 text-destructive",
};

/** Live states — order is in flight. */
export const TERMINAL_STATUSES = ["delivered", "cancelled", "expired", "no_driver_found"];
export const SEARCHING_STATUSES = ["pending", "searching"];

/** Ordered driver workflow after accepting. */
export const DRIVER_FLOW = [
  { status: "going_to_shop", label: "Start — going to shop" },
  { status: "arrived_at_shop", label: "I've arrived at the shop" },
  { status: "payment_received", label: "I paid the shop" },
  { status: "picked_up", label: "Order picked up" },
  { status: "going_to_customer", label: "Going to customer" },
  { status: "arrived_at_customer", label: "Arrived at customer" },
  { status: "delivered", label: "Complete delivery" },
] as const;

export function fmtINR(n: number | string | null | undefined) {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return `₹${(v as number).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function minutesLeft(iso: string | null | undefined) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / 60000);
}
