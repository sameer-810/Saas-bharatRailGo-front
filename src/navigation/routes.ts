/**
 * Route registry — the single map of route name → screen → URL path.
 * Screens come from each module's index.ts. Params:
 *   *Detail / *Edit routes take { id: string }.
 *   BookingNew / BiltiNew / PaymentNew / InvoiceNew accept optional { partyId }.
 */
import { dashboardScreens } from "@modules/dashboard";
import { bookingsScreens } from "@modules/bookings";
import { biltiScreens } from "@modules/bilti";
import { partiesScreens } from "@modules/parties";
import { paymentsScreens } from "@modules/payments";
import { invoicesScreens } from "@modules/invoices";
import { reportsScreens } from "@modules/reports";
import { settingsScreens } from "@modules/settings";
import { adminScreens } from "@modules/admin";
import { MoreScreen } from "./MoreScreen";

export const appScreens = {
  ...dashboardScreens,
  ...bookingsScreens,
  ...biltiScreens,
  ...partiesScreens,
  ...paymentsScreens,
  ...invoicesScreens,
  ...reportsScreens,
  ...settingsScreens,
  More: MoreScreen,
} as const;

export type AppRoute = keyof typeof appScreens;

/** URL paths for the web build (browser address bar, refresh, back/forward). */
export const appPaths: Record<AppRoute, string> = {
  Home: "",
  Bookings: "bookings",
  BookingNew: "bookings/new",
  DailySummary: "bookings/daily-summary",
  LoadingList: "bookings/loading-list",
  BookingDetail: "bookings/:id",
  BookingEdit: "bookings/:id/edit",
  Bilti: "bilti",
  BiltiNew: "bilti/new",
  BiltiDetail: "bilti/:id",
  BiltiEdit: "bilti/:id/edit",
  Parties: "parties",
  PartyNew: "parties/new",
  PartyDetail: "parties/:id",
  PartyEdit: "parties/:id/edit",
  Payments: "payments",
  PaymentNew: "payments/new",
  PaymentDetail: "payments/:id",
  Invoices: "invoices",
  InvoiceNew: "invoices/new",
  InvoiceDetail: "invoices/:id",
  Reports: "reports",
  ReportDaily: "reports/daily",
  ReportOutstanding: "reports/outstanding",
  ReportStation: "reports/station",
  ReportGst: "reports/gst",
  Settings: "settings",
  SettingsBusiness: "settings/business",
  SettingsBranding: "settings/branding",
  Team: "settings/team",
  Branches: "settings/branches",
  Stations: "settings/stations",
  Rates: "settings/rates",
  Plan: "settings/plan",
  Activity: "settings/activity",
  Privacy: "settings/privacy",
  More: "more",
};

export const adminAppScreens = adminScreens;
export type AdminRoute = keyof typeof adminScreens | "AdminLogin";

export const adminPaths: Record<AdminRoute, string> = {
  AdminLogin: "admin/login",
  AdminDashboard: "admin",
  AdminOrgs: "admin/organizations",
  AdminOrgDetail: "admin/organizations/:id",
  AdminPlans: "admin/plans",
  AdminAudit: "admin/audit",
  AdminBackups: "admin/backups",
};
