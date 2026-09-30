/** Bilti (POD) types — mirror of bharatrailgo-back/src/modules/pod/pod.dto.js */

export const DELIVERY_STATUSES = [
  "received",
  "loaded",
  "in_transit",
  "unloaded",
  "delivered",
  "returned",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** The forward path shown in the stepper; "returned" is a side exit. */
export const STATUS_FLOW: DeliveryStatus[] = [
  "received",
  "loaded",
  "in_transit",
  "unloaded",
  "delivered",
];

export const STATUS_LABEL: Record<DeliveryStatus, string> = {
  received: "Received",
  loaded: "Loaded",
  in_transit: "In transit",
  unloaded: "Unloaded",
  delivered: "Delivered",
  returned: "Returned",
};

export interface PodPartyRef {
  id: string;
  name: string;
  mobile?: string;
}

export interface Pod {
  id: string;
  branch: string | null;
  podNumber: number;
  date: string;
  consignorName: string;
  consignorMobile?: string;
  consignorAddress?: string;
  consigneeName: string;
  consigneeMobile?: string;
  consigneeAddress?: string;
  party: PodPartyRef | string | null;
  packages: number;
  actualWeight?: number;
  chargeableWeight: number;
  contents?: string;
  givenName?: string;
  originStation: string;
  destinationStation: string;
  paidAmount: number;
  toPayAmount: number;
  otherCharges: number;
  totalAmount: number;
  deliveryStatus: DeliveryStatus;
  loadedOn?: string;
  deliveredOn?: string;
  railwayReceiptNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PodInput {
  date?: string;
  consignorName: string;
  consignorMobile?: string;
  consignorAddress?: string;
  consigneeName: string;
  consigneeMobile?: string;
  consigneeAddress?: string;
  party?: string;
  packages: number;
  actualWeight?: number;
  chargeableWeight: number;
  contents?: string;
  givenName?: string;
  originStation?: string;
  destinationStation: string;
  paidAmount: number;
  toPayAmount: number;
  otherCharges: number;
  railwayReceiptNumber?: string;
  notes?: string;
}

/** Result of the best-effort status SMS (PATCH /pods/:id/status → meta.sms). */
export interface SmsResult {
  attempted: boolean;
  sent?: boolean;
  sentTo?: string[];
  reason?: string;
}

export function biltiNo(
  prefix: string | undefined,
  podNumber: number | undefined | null,
): string {
  if (podNumber == null) return "—";
  return `${prefix || ""}${podNumber}`;
}

export function partyIdOf(p: Pod["party"]): string | undefined {
  if (!p) return undefined;
  return typeof p === "string" ? p : p.id;
}

/** wa.me wants country code + digits. 10-digit Indian numbers get 91. */
export function waNumber(mobile?: string): string | null {
  const d = String(mobile || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10) return `91${d}`;
  if (d.length === 11 && d.startsWith("0")) return `91${d.slice(1)}`;
  return d;
}
