/**
 * Sidebar / tab bar / command palette entries. `perm` hides an item from
 * roles that cannot use it (the server enforces it anyway).
 */
import {
  BarChart3,
  Building2,
  FileText,
  IndianRupee,
  LayoutDashboard,
  Package,
  ReceiptText,
  History,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react-native";
import type { AppRoute } from "./routes";
import type { Permission } from "@shared/lib/permissions";

export interface NavItem {
  route: AppRoute;
  label: string;
  icon: LucideIcon;
  group: "Operations" | "Money" | "Insights" | "Setup";
  perm?: Permission;
  /** Extra words the command palette matches on. */
  keywords?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { route: "Home", label: "Departure board", icon: LayoutDashboard, group: "Operations", keywords: "home dashboard today" },
  { route: "Bookings", label: "Bookings", icon: Package, group: "Operations", keywords: "consignments parcels" },
  { route: "Bilti", label: "Bilti / POD", icon: ReceiptText, group: "Operations", keywords: "pod receipt delivery" },
  { route: "Parties", label: "Parties", icon: Users, group: "Operations", keywords: "customers clients ledger" },
  { route: "Payments", label: "Payments", icon: IndianRupee, group: "Money", keywords: "collection receipt cash upi" },
  { route: "Invoices", label: "GST invoices", icon: FileText, group: "Money", keywords: "bill gst tax" },
  { route: "Reports", label: "Reports", icon: BarChart3, group: "Insights", keywords: "daily outstanding station gst excel" },
  { route: "Activity", label: "Activity log", icon: History, group: "Insights", perm: "audit.view", keywords: "audit who changed deleted history log sign in" },
  { route: "Branches", label: "Branches", icon: Building2, group: "Setup", perm: "branches.manage" },
  { route: "Settings", label: "Settings", icon: Settings, group: "Setup", keywords: "profile logo team stations rates plan" },
];

/** Phone bottom tabs (the rest lives under "More"). */
export const TAB_ROUTES: AppRoute[] = ["Home", "Bookings", "Bilti", "Payments"];

/** Quick actions offered by the command palette. */
export const QUICK_ACTIONS: { label: string; route: AppRoute; keywords: string; perm?: Permission }[] = [
  { label: "New booking", route: "BookingNew", keywords: "add consignment parcel create" },
  { label: "New bilti", route: "BiltiNew", keywords: "add pod receipt create" },
  { label: "Record payment", route: "PaymentNew", keywords: "receive money collect cash upi" },
  { label: "New GST invoice", route: "InvoiceNew", keywords: "bill create" },
  { label: "New party", route: "PartyNew", keywords: "customer add" },
  { label: "Today's loading list", route: "LoadingList", keywords: "train bogie load" },
  { label: "Outstanding report", route: "ReportOutstanding", keywords: "due pending money" },
  { label: "Team & users", route: "Team", keywords: "staff manager invite", perm: "users.manage" },
  { label: "Rate card", route: "Rates", keywords: "charge heads freight hamali price" },
  { label: "Plan & usage", route: "Plan", keywords: "subscription upgrade trial" },
  { label: "Privacy & data", route: "Privacy", keywords: "download export delete account dpdp gdpr", perm: "account.manage" },
];
