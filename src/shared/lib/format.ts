/** Indian formatting helpers — rupees, dates, numbers. */

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** ₹1,23,456.00 — or ₹1.2L / ₹3.4Cr when compact. */
export function formatMoney(v: number | null | undefined, { compact = false } = {}): string {
  const n = Number(v || 0);
  if (compact) {
    const abs = Math.abs(n);
    if (abs >= 1e7) return `₹${num.format(n / 1e7)}Cr`;
    if (abs >= 1e5) return `₹${num.format(n / 1e5)}L`;
    if (abs >= 1e3) return `₹${num.format(n / 1e3)}K`;
    return `₹${inr0.format(n)}`;
  }
  return `₹${inr.format(n)}`;
}

export function formatNumber(v: number | null | undefined): string {
  return num.format(Number(v || 0));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 24 Sep 2026 */
export function formatDate(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** 24 Sep, 4:05 pm */
export function formatDateTime(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  const h = d.getHours();
  const hh = h % 12 || 12;
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}, ${hh}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** YYYY-MM-DD in local time — the format every API date field accepts. */
export function isoDay(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function startOfMonth(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
