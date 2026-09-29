/** Consignment ("booking") shapes and enums — mirror of bharatrailgo-back consignment module. */
import type { Option } from "@shared/ui/controls";

export const PAYMENT_MODES = ["paid_source", "to_pay", "on_bill", "slip"] as const;
export const PAYMENT_STATUS = ["pending", "partial", "received", "settled"] as const;
export const CONSIGNMENT_TYPES = [
  "railway_booking",
  "own_bogie",
  "agent_handover",
  "agent_received",
  "delivery",
] as const;
export const DELIVERY_STATUS = ["received", "loaded", "in_transit", "unloaded", "delivered", "returned"] as const;
/** The forward lifecycle shown on the stepper ("returned" is a side exit). */
export const DELIVERY_FLOW = ["received", "loaded", "in_transit", "unloaded", "delivered"] as const;

export type PaymentMode = (typeof PAYMENT_MODES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];
export type ConsignmentType = (typeof CONSIGNMENT_TYPES)[number];
export type DeliveryStatus = (typeof DELIVERY_STATUS)[number];

export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  paid_source: "Paid",
  to_pay: "To pay",
  on_bill: "On bill",
  slip: "Slip",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  partial: "Partial",
  received: "Received",
  settled: "Settled",
};

export const TYPE_LABEL: Record<ConsignmentType, string> = {
  railway_booking: "Railway booking",
  own_bogie: "Own bogie",
  agent_handover: "Agent handover",
  agent_received: "Agent received",
  delivery: "Delivery",
};

export const DELIVERY_LABEL: Record<DeliveryStatus, string> = {
  received: "Received",
  loaded: "Loaded",
  in_transit: "In transit",
  unloaded: "Unloaded",
  delivered: "Delivered",
  returned: "Returned",
};

export const paymentModeOptions: Option<PaymentMode>[] = PAYMENT_MODES.map((v) => ({
  value: v,
  label: PAYMENT_MODE_LABEL[v],
}));
export const paymentStatusOptions: Option<PaymentStatus>[] = PAYMENT_STATUS.map((v) => ({
  value: v,
  label: PAYMENT_STATUS_LABEL[v],
}));
export const typeOptions: Option<ConsignmentType>[] = CONSIGNMENT_TYPES.map((v) => ({
  value: v,
  label: TYPE_LABEL[v],
}));

export interface ConsignmentParty {
  id: string;
  name: string;
  mobile?: string;
  gstin?: string;
  defaultPaymentMode?: PaymentMode;
}

export interface ConsignmentInvoice {
  id: string;
  billNumber?: string;
  status?: string;
  date?: string;
}

export interface Consignment {
  id: string;
  branch: string | null;
  date: string;
  party: ConsignmentParty | string | null;
  packages: number;
  actualWeight?: number;
  chargeableWeight?: number;
  contents?: string;
  originStation: string;
  destinationStation: string;
  type: ConsignmentType;
  deliveryStatus: DeliveryStatus;
  paymentReceiver: string | null;
  isLease: boolean;
  isBooking: boolean;
  agentName?: string;
  trainNumber?: string;
  bogieNumber?: string;
  railwayReceiptNumber?: string;
  freightAmount: number;
  reimbursementAmount: number;
  hamaliCharges: number;
  otherCharges: number;
  totalAmount: number;
  amountPaid: number;
  directPaid: number;
  balanceDue: number;
  paymentMode: PaymentMode;
  paymentStatus: PaymentStatus;
  invoice: ConsignmentInvoice | string | null;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function partyName(c: Pick<Consignment, "party">): string {
  if (!c.party) return "—";
  return typeof c.party === "string" ? "—" : c.party.name;
}

export function partyId(c: Pick<Consignment, "party">): string | undefined {
  if (!c.party) return undefined;
  return typeof c.party === "string" ? c.party : c.party.id;
}

export interface QuoteLine {
  name: string;
  appliesTo: "freight" | "hamali" | "other" | "reimbursement";
  basis: "per_kg" | "per_package" | "flat";
  rate: number;
  qty: number;
  amount: number;
}

export interface Quote {
  freightAmount: number;
  hamaliCharges: number;
  otherCharges: number;
  reimbursementAmount: number;
  totalAmount: number;
  lines: QuoteLine[];
}

export interface DailySummary {
  date: string;
  consignments: Consignment[];
  summary: {
    totalConsignments: number;
    grandPackages: number;
    grandWeight: number;
    grandTotalAmount: number;
    byPaymentMode: Record<string, { count: number; packages: number; amount: number }>;
    byStation: Record<string, { count: number; packages: number; weight: number; amount: number }>;
  };
}

export interface LoadingListGroup {
  station: string;
  consignments: Consignment[];
  totals: { packages: number; weight: number; amount: number };
}

export interface LoadingList {
  date: string;
  stations: LoadingListGroup[];
  grandTotals: { packages: number; weight: number; amount: number; totalConsignments: number };
}

/** Route params BookingNew understands (also produced by the quick-entry bar). */
export interface BookingPrefill {
  partyId?: string;
  partyName?: string;
  destinationStation?: string;
  originStation?: string;
  packages?: number;
  chargeableWeight?: number;
  paymentMode?: PaymentMode;
  freightAmount?: number;
}
