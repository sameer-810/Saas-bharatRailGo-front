/** API shapes for the invoices module (mirror of bharatrailgo-back invoice.dto.js). */

export const INVOICE_STATUSES = ["draft", "sent", "paid", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  cancelled: "Cancelled",
};

export interface InvoicePartyRef {
  id: string;
  name: string;
  mobile?: string;
  gstin?: string;
  address?: string;
}

/** Consignment fields this module reads (consignment.dto.js). */
export interface InvoiceConsignment {
  id: string;
  date: string;
  createdAt?: string;
  party: InvoicePartyRef | string | null;
  packages?: number;
  contents?: string;
  originStation?: string;
  destinationStation?: string;
  railwayReceiptNumber?: string;
  trainNumber?: string;
  freightAmount: number;
  reimbursementAmount: number;
  hamaliCharges: number;
  otherCharges: number;
  totalAmount: number;
  balanceDue?: number;
  paymentMode: string;
  paymentStatus: string;
  invoice: { id: string; billNumber?: string; status?: string } | string | null;
}

export interface Invoice {
  id: string;
  branch: string | null;
  billNumber: string;
  billNumberRaw?: number;
  party: InvoicePartyRef | string | null;
  partySnapshot?: { name?: string; address?: string; gstin?: string };
  date: string;
  consignments: (InvoiceConsignment | string)[];
  reimbursementSubtotal: number;
  serviceSubtotal: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  grossTotal: number;
  amountInWords?: string;
  status: InvoiceStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceCreateInput {
  party: string;
  date: string;
  consignmentIds: string[];
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  notes?: string;
}

export interface InvoiceUpdateInput {
  date?: string;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  notes?: string;
}

export const INVOICE_INVALIDATE = ["invoices", "consignments", "parties", "dashboard", "reports"];

export function invoicePartyName(inv: Pick<Invoice, "party" | "partySnapshot">): string {
  if (inv.partySnapshot?.name) return inv.partySnapshot.name;
  if (!inv.party) return "—";
  return typeof inv.party === "string" ? inv.party : inv.party.name;
}

export function invoicePartyId(inv: Pick<Invoice, "party">): string | undefined {
  if (!inv.party) return undefined;
  return typeof inv.party === "string" ? inv.party : inv.party.id;
}
