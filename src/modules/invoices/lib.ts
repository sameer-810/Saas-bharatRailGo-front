/**
 * Invoice maths — a line-for-line mirror of the backend:
 *   invoice.service.js computeSubtotals() and the InvoiceModel pre-save hook.
 * Pure Agent GST: reimbursement (railway freight paid on the party's behalf)
 * is NOT taxable; CGST/SGST or IGST apply to the service subtotal only.
 */
import { useMemo } from "react";
import { useApiList } from "@shared/api/query";
import { formatDate } from "@shared/lib/format";
import type { InvoiceConsignment } from "./types";

type Chargeable = Pick<InvoiceConsignment, "freightAmount" | "hamaliCharges" | "otherCharges" | "reimbursementAmount">;

const fix2 = (n: number) => parseFloat(n.toFixed(2));

export function serviceOf(c: Chargeable) {
  return (c.freightAmount || 0) + (c.hamaliCharges || 0) + (c.otherCharges || 0);
}

export function computeSubtotals(consignments: Chargeable[]) {
  let serviceSubtotal = 0;
  let reimbursementSubtotal = 0;
  for (const c of consignments) {
    serviceSubtotal += serviceOf(c);
    reimbursementSubtotal += c.reimbursementAmount || 0;
  }
  return { serviceSubtotal: fix2(serviceSubtotal), reimbursementSubtotal: fix2(reimbursementSubtotal) };
}

export interface Rates {
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
}

export interface Totals extends Rates {
  serviceSubtotal: number;
  reimbursementSubtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  grossTotal: number;
}

export function computeTotals(
  sub: { serviceSubtotal: number; reimbursementSubtotal: number },
  rates: Rates,
): Totals {
  const service = sub.serviceSubtotal || 0;
  const reimb = sub.reimbursementSubtotal || 0;
  const cgstAmount = fix2((service * (rates.cgstRate || 0)) / 100);
  const sgstAmount = fix2((service * (rates.sgstRate || 0)) / 100);
  const igstAmount = fix2((service * (rates.igstRate || 0)) / 100);
  const grossTotal = fix2(reimb + service + cgstAmount + sgstAmount + igstAmount);
  return { ...sub, ...rates, cgstAmount, sgstAmount, igstAmount, grossTotal };
}

export type GstMode = "intra" | "inter";

/** Rates for a GST mode. Intra-state: CGST + SGST from the business profile; inter-state: IGST = their sum. */
export function ratesFor(mode: GstMode, defaults: { cgst?: number; sgst?: number }): Rates {
  const cgst = defaults.cgst ?? 2.5;
  const sgst = defaults.sgst ?? 2.5;
  return mode === "intra"
    ? { cgstRate: cgst, sgstRate: sgst, igstRate: 0 }
    : { cgstRate: 0, sgstRate: 0, igstRate: fix2(cgst + sgst) };
}

/**
 * A party's on-bill consignments that are not on any invoice yet (the list
 * API already hides deleted ones). Oldest first.
 */
export function useUninvoicedConsignments(partyId: string | undefined) {
  const list = useApiList<InvoiceConsignment>(
    "consignments",
    "/consignments",
    { party: partyId, paymentMode: "on_bill", limit: 1000 },
    { enabled: !!partyId },
  );
  const items = useMemo(
    () =>
      (list.data?.items || [])
        .filter((c) => c.invoice == null && c.paymentMode === "on_bill")
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [list.data],
  );
  return { items, isLoading: !!partyId && list.isLoading, error: list.error, refetch: () => list.refetch() };
}

export function routeLabel(c: Pick<InvoiceConsignment, "originStation" | "destinationStation">) {
  return [c.originStation, c.destinationStation].filter(Boolean).join(" → ") || "—";
}

export function consignmentLabel(c: InvoiceConsignment) {
  return `${formatDate(c.date)} · ${routeLabel(c)}`;
}
