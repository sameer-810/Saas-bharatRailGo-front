/** Report row shapes (mirror bharatrailgo-back/src/modules/reports/reports.service.js). */
import { addDays, isoDay, startOfMonth } from "@shared/lib/format";

export interface DailyReportRow {
  date: string;
  consignmentCount: number;
  totalPackages: number;
  totalChargeableWeight: number;
  totalFreight: number;
  totalReimbursement: number;
  totalHamali: number;
  totalOther: number;
  totalAmount: number;
}

export interface OutstandingRow {
  partyId: string | null;
  partyName?: string;
  partyCity?: string;
  mobile?: string;
  consignmentCount: number;
  totalAmount: number;
  totalFreight: number;
  totalReimbursement: number;
  aged0to30: number;
  aged31to60: number;
  aged61to90: number;
  aged90Plus: number;
}

export interface StationReportRow {
  station: string | null;
  consignmentCount: number;
  totalPackages: number;
  totalChargeableWeight: number;
  totalFreight: number;
  totalAmount: number;
}

export interface GstRow {
  billNumber: string;
  date: string;
  partyName?: string;
  gstin?: string;
  status: string;
  reimbursementSubtotal: number;
  serviceSubtotal: number;
  cgstRate: number;
  sgstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  grossTotal: number;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export type RangePreset = "today" | "week" | "month" | "lastMonth";

export function presetRange(p: RangePreset, now = new Date()): DateRange {
  const today = isoDay(now);
  if (p === "today") return { startDate: today, endDate: today };
  if (p === "week") {
    // Week starts Monday.
    const offset = (now.getDay() + 6) % 7;
    return { startDate: isoDay(addDays(now, -offset)), endDate: today };
  }
  if (p === "month")
    return { startDate: isoDay(startOfMonth(now)), endDate: today };
  const firstThis = startOfMonth(now);
  const lastPrev = addDays(firstThis, -1);
  return {
    startDate: isoDay(startOfMonth(lastPrev)),
    endDate: isoDay(lastPrev),
  };
}

export function sum<T>(rows: T[] | undefined, pick: (r: T) => number): number {
  return (
    Math.round((rows || []).reduce((s, r) => s + (pick(r) || 0), 0) * 100) / 100
  );
}
