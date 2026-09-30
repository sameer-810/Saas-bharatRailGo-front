/** Party types — mirror of bharatrailgo-back/src/modules/party/party.{dto,service}.js */

export const PAYMENT_MODES = [
  "paid_source",
  "to_pay",
  "on_bill",
  "slip",
] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  paid_source: "Paid at source",
  to_pay: "To pay",
  on_bill: "On bill (credit)",
  slip: "Slip",
};

export function paymentModeLabel(m?: string | null): string {
  return (m && PAYMENT_MODE_LABEL[m as PaymentMode]) || (m ? m : "—");
}

export interface Party {
  id: string;
  name: string;
  gstin?: string;
  pan?: string;
  email?: string;
  mobile?: string;
  alternateMobile?: string;
  defaultStation?: string;
  address?: string;
  city?: string;
  state?: string;
  defaultPaymentMode?: PaymentMode;
  openingBalance: number;
  /** Set once the customer's personal data was erased (DPDP request). */
  erasedAt?: string | null;
  erasureMode?: "anonymised" | "redacted" | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PartyInput {
  name: string;
  gstin?: string;
  pan?: string;
  email?: string;
  mobile?: string;
  alternateMobile?: string;
  defaultStation?: string;
  address?: string;
  city?: string;
  state?: string;
  defaultPaymentMode?: PaymentMode;
  openingBalance?: number;
}

export interface LedgerRow {
  date: string;
  type: "opening" | "consignment" | "payment";
  refId?: string;
  description: string;
  debit: number;
  credit: number;
  paymentMode?: string;
  balance: number;
}

export interface PartyLedger {
  party: {
    id: string;
    name: string;
    mobile?: string;
    gstin?: string;
    openingBalance: number;
  };
  ledger: LedgerRow[];
  totalOutstanding: number;
}

/** wa.me wants country code + digits. 10-digit Indian numbers get 91. */
export function waNumber(mobile?: string): string | null {
  const d = String(mobile || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10) return `91${d}`;
  if (d.length === 11 && d.startsWith("0")) return `91${d.slice(1)}`;
  return d;
}
