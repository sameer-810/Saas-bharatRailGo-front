/**
 * Activity log — types and plain-language wording for the action names written
 * by bharatrailgo-back/src/modules/audit/audit.service.js ("<resource>.<verb>").
 */
import type { AppRoute } from "@navigation/routes";

export interface ActivityEntry {
  id: string;
  at: string;
  actor: { id: string; name?: string; role?: string } | null;
  action: string;
  outcome: "ok" | "denied";
  method?: string;
  path?: string;
  targetType?: string;
  targetId?: string;
  label?: string;
  fields: string[];
  ip?: string;
  userAgent?: string;
}

const NOUN: Record<string, string> = {
  consignment: "booking",
  pod: "bilti",
  invoice: "GST bill",
  payment: "payment",
  party: "party",
  branch: "branch",
  station: "station",
  charge_head: "rate",
  settings: "business profile",
  user: "team member",
  report: "report",
  billing: "subscription",
};

const VERB: Record<string, string> = {
  create: "Created",
  update: "Edited",
  delete: "Deleted",
  status: "Changed the status of",
  finalize: "Finalised",
  cancel: "Cancelled",
  pdf: "Printed / downloaded",
  consignments_remove: "Removed a booking from",
};

/** Whole-action wording where "<verb> <noun>" would read badly. */
const EXACT: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.login_failed": "Sign-in failed (wrong password)",
  "auth.login_locked": "Sign-in blocked (too many attempts)",
  "settings.logo": "Uploaded the logo",
  "settings.logo_remove": "Removed the logo",
  "settings.init": "Set up the business profile",
  "backup.email": "Emailed a data backup",
  "invoice.mark_paid": "Marked a GST bill as paid",
  "invoice.consignments": "Added bookings to a GST bill",
  "privacy.parties_export": "Downloaded a customer's data",
  "privacy.parties_erase": "Erased a customer's personal data",
  "privacy.account_export": "Downloaded all agency data",
  "privacy.account_deletion": "Requested account deletion",
  "privacy.account_deletion_remove": "Cancelled the account deletion request",
  "billing.checkout": "Started a subscription payment",
  "billing.autopay_cancel": "Cancelled autopay",
};

export function describeAction(action: string): string {
  if (EXACT[action]) return EXACT[action];
  const [resource, verb = ""] = action.split(".");
  if (resource === "report") {
    const name = verb.replace(/_export$/, "");
    return `Exported the ${name} report`;
  }
  const noun = NOUN[resource] || resource.replace(/_/g, " ");
  const v = VERB[verb];
  if (v) return `${v} ${verb === "pdf" ? `${noun} PDF` : `a ${noun}`}`.replace(/ a (?=[aeiou])/i, " an ");
  return `${noun}: ${verb.replace(/_/g, " ")}`;
}

/** Filter chips → backend `action` prefix. */
export const ACTIVITY_GROUPS: { key: string; label: string; prefix: string }[] = [
  { key: "all", label: "All", prefix: "" },
  { key: "auth", label: "Sign-ins", prefix: "auth." },
  { key: "consignment", label: "Bookings", prefix: "consignment." },
  { key: "pod", label: "Bilti", prefix: "pod." },
  { key: "invoice", label: "GST bills", prefix: "invoice." },
  { key: "payment", label: "Payments", prefix: "payment." },
  { key: "party", label: "Parties", prefix: "party." },
  { key: "report", label: "Exports", prefix: "report." },
  { key: "user", label: "Team", prefix: "user." },
  { key: "settings", label: "Settings", prefix: "settings." },
  { key: "privacy", label: "Privacy", prefix: "privacy." },
];

/** Where a row's record opens (not for deletes — the record is gone). */
export function targetRoute(e: ActivityEntry): { route: AppRoute; id: string } | null {
  if (!e.targetId || e.action.endsWith(".delete") || e.outcome === "denied") return null;
  const route: Partial<Record<string, AppRoute>> = {
    consignment: "BookingDetail",
    pod: "BiltiDetail",
    invoice: "InvoiceDetail",
    payment: "PaymentDetail",
    party: "PartyDetail",
  };
  const r = e.targetType ? route[e.targetType] : undefined;
  return r ? { route: r, id: e.targetId } : null;
}

/** "Chrome on Windows" from a user-agent string — enough to spot an unknown device. */
export function deviceOf(ua?: string): string {
  if (!ua) return "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : /okhttp|Expo|ReactNative/i.test(ua)
            ? "App"
            : "";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS/.test(ua)
          ? "Mac"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return [browser, os].filter(Boolean).join(" on ");
}
