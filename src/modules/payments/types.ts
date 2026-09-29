/** API shapes for the payments module (mirror of bharatrailgo-back payment.dto.js). */
import type { Option } from "@shared/ui";

export const PAYMENT_MODES = ["cash", "upi", "bank_transfer", "cheque", "other"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  other: "Other",
};

export const PAYMENT_MODE_OPTIONS: Option<PaymentMode>[] = PAYMENT_MODES.map((m) => ({
  value: m,
  label: PAYMENT_MODE_LABEL[m],
}));

export interface PartyRef {
  id: string;
  name: string;
  mobile?: string;
}

export interface Allocation {
  consignment: string;
  amount: number;
}

export interface Payment {
  id: string;
  branch: string | null;
  party: PartyRef | string | null;
  amount: number;
  date: string;
  mode: PaymentMode;
  referenceNumber?: string;
  notes?: string;
  receivedBy: { id: string; name: string } | string | null;
  allocations: Allocation[];
  unallocatedAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentInput {
  party?: string;
  amount?: number;
  date?: string;
  mode?: PaymentMode;
  referenceNumber?: string;
  notes?: string;
}

/** The consignment fields this module reads (consignment.dto.js). */
export interface ConsignmentLite {
  id: string;
  date: string;
  createdAt: string;
  party: PartyRef | string | null;
  originStation?: string;
  destinationStation?: string;
  railwayReceiptNumber?: string;
  contents?: string;
  packages?: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentMode: "paid_source" | "to_pay" | "on_bill" | "slip";
  paymentStatus: "pending" | "partial" | "received" | "settled";
}

export function partyName(p: Payment["party"]): string {
  if (!p) return "—";
  return typeof p === "string" ? p : p.name;
}

export function partyId(p: Payment["party"]): string | undefined {
  if (!p) return undefined;
  return typeof p === "string" ? p : p.id;
}
