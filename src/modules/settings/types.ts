/** Settings module — API shapes (mirrors bharatrailgo-back DTOs). */
import type { Limits, Role } from "@shared/store/useAuthStore";

export interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  branches: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  /** Not in the DTO yet (see API gaps) — shown when the server sends it. */
  lastLoginAt?: string | null;
}

export type AppliesTo = "freight" | "hamali" | "other" | "reimbursement";
export type Basis = "per_kg" | "per_package" | "flat";

export interface ChargeHead {
  id: string;
  name: string;
  appliesTo: AppliesTo;
  basis: Basis;
  rate: number;
  minAmount: number;
  stationCode: string | null;
  isActive: boolean;
}

export interface QuoteLine {
  name: string;
  appliesTo: AppliesTo;
  basis: Basis;
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

export interface PublicPlan {
  id: string;
  code: string;
  name: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  limits: Limits;
  isTrial: boolean;
  isFeatured: boolean;
  sortOrder: number;
}

export const APPLIES_TO_LABEL: Record<AppliesTo, string> = {
  freight: "Freight",
  hamali: "Hamali",
  other: "Other charges",
  reimbursement: "Reimbursement",
};

export const BASIS_LABEL: Record<Basis, string> = {
  per_kg: "Per kg",
  per_package: "Per package",
  flat: "Flat",
};

/** Where "Request upgrade" goes until online payment exists. */
export const SUPPORT_EMAIL = "support@bharatrailgo.in";
/** Country code + digits for wa.me; empty hides the WhatsApp button. TODO: set the real support number. */
export const SUPPORT_WHATSAPP = "";
