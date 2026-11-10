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

/** Shops and drivers are physically local to whoever they transact with —
 *  the delivery charge a shop in Riyadh enters is a SAR amount the moment
 *  they type it, same as a shop in Kasargod typing a ₹ amount. There's no
 *  exchange rate here: each shop/driver just picks which symbol their own
 *  numbers mean, and every amount tied to them displays with that symbol. */
export const CURRENCIES: Record<string, { symbol: string; locale: string; label: string }> = {
  INR: { symbol: "₹", locale: "en-IN", label: "Indian Rupee (₹)" },
  USD: { symbol: "$", locale: "en-US", label: "US Dollar ($)" },
  SAR: { symbol: "SR", locale: "en-US", label: "Saudi Riyal (SR)" },
  AED: { symbol: "AED", locale: "en-US", label: "UAE Dirham (AED)" },
  QAR: { symbol: "QR", locale: "en-US", label: "Qatari Riyal (QR)" },
  KWD: { symbol: "KD", locale: "en-US", label: "Kuwaiti Dinar (KD)" },
  BHD: { symbol: "BD", locale: "en-US", label: "Bahraini Dinar (BD)" },
  OMR: { symbol: "OMR", locale: "en-US", label: "Omani Rial (OMR)" },
  GBP: { symbol: "£", locale: "en-GB", label: "British Pound (£)" },
  EUR: { symbol: "€", locale: "en-IE", label: "Euro (€)" },
};

export function fmtCurrency(n: number | string | null | undefined, currency?: string | null) {
  const cfg = CURRENCIES[currency ?? "INR"] ?? CURRENCIES.INR;
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return `${cfg.symbol}${(v as number).toLocaleString(cfg.locale, { maximumFractionDigits: 0 })}`;
}

export function fmtINR(n: number | string | null | undefined) {
  return fmtCurrency(n, "INR");
}

const EURO_ZONE = new Set([
  "AT",
  "BE",
  "CY",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PT",
  "SK",
  "SI",
  "ES",
  "HR",
]);

/** Maps a reverse-geocoded ISO 3166-1 country code to one of the
 *  currencies this app actually offers. Anything we don't recognize falls
 *  back to INR (the business's home currency) rather than guessing. */
export function currencyForCountry(countryCode?: string | null): string {
  const cc = (countryCode ?? "").toUpperCase();
  switch (cc) {
    case "US":
      return "USD";
    case "SA":
      return "SAR";
    case "AE":
      return "AED";
    case "QA":
      return "QAR";
    case "KW":
      return "KWD";
    case "BH":
      return "BHD";
    case "OM":
      return "OMR";
    case "GB":
      return "GBP";
    default:
      return EURO_ZONE.has(cc) ? "EUR" : "INR";
  }
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
