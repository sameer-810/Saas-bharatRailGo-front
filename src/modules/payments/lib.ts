/**
 * Payments helpers: the client-side FIFO preview (a mirror of
 * bharatrailgo-back payment.service.js allocateFifo) and the party's open
 * consignments query.
 */
import { useMemo } from "react";
import { useApiList } from "@shared/api/query";
import { formatDate } from "@shared/lib/format";
import type { ConsignmentLite } from "./types";

export function round2(n: number | undefined | null): number {
  return Math.round((n || 0) * 100) / 100;
}

export interface PreviewLine {
  consignment: ConsignmentLite;
  due: number;
  applied: number;
  remainingDue: number;
}

/**
 * Same maths as the server: walk open consignments oldest first, filling each
 * one's balance. Whatever is left becomes the advance (unallocatedAmount).
 */
export function fifoPreview(amount: number, open: ConsignmentLite[]) {
  let remaining = round2(amount);
  const lines: PreviewLine[] = [];
  for (const c of open) {
    const due = round2((c.totalAmount || 0) - (c.amountPaid || 0));
    if (due <= 0) continue;
    const applied = remaining > 0 ? round2(Math.min(remaining, due)) : 0;
    remaining = round2(remaining - applied);
    lines.push({
      consignment: c,
      due,
      applied,
      remainingDue: round2(due - applied),
    });
  }
  return { lines, advance: Math.max(0, remaining) };
}

/** Oldest first, as the backend sorts in findOpenForAllocation. */
function byAge(a: ConsignmentLite, b: ConsignmentLite) {
  const d = new Date(a.date).getTime() - new Date(b.date).getTime();
  if (d !== 0) return d;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

/**
 * A party's open to_pay / on_bill consignments (pending or partial), oldest
 * first — exactly the set a new payment is allocated against. The list API
 * takes a single paymentStatus, so pending and partial are fetched separately.
 */
export function useOpenConsignments(partyId: string | undefined) {
  const base = { party: partyId, limit: 1000 };
  const enabled = !!partyId;
  const pending = useApiList<ConsignmentLite>(
    "consignments",
    "/consignments",
    { ...base, paymentStatus: "pending" },
    { enabled },
  );
  const partial = useApiList<ConsignmentLite>(
    "consignments",
    "/consignments",
    { ...base, paymentStatus: "partial" },
    { enabled },
  );
  const items = useMemo(() => {
    if (!enabled) return [];
    const all = [
      ...(pending.data?.items || []),
      ...(partial.data?.items || []),
    ];
    return all
      .filter((c) => c.paymentMode === "to_pay" || c.paymentMode === "on_bill")
      .sort(byAge);
  }, [enabled, pending.data, partial.data]);
  const totalDue = round2(
    items.reduce((s, c) => s + round2(c.totalAmount - c.amountPaid), 0),
  );
  return {
    items,
    totalDue,
    isLoading: enabled && (pending.isLoading || partial.isLoading),
    error: pending.error || partial.error,
    refetch: () => {
      pending.refetch();
      partial.refetch();
    },
  };
}

/** Short human label for a consignment row. */
export function consignmentLabel(
  c: Pick<ConsignmentLite, "date" | "originStation" | "destinationStation">,
) {
  const route = [c.originStation, c.destinationStation]
    .filter(Boolean)
    .join(" → ");
  return `${formatDate(c.date)}${route ? ` · ${route}` : ""}`;
}
