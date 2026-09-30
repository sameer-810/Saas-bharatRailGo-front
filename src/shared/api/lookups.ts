/**
 * Shared lookups used by many modules: party / station search for comboboxes,
 * branches, business profile and /auth/me.
 */
import { apiClient, type Envelope } from "./apiClient";
import { useApiGet } from "./query";
import type { Option } from "../ui/controls";
import type { Subscription, User, Organization } from "../store/useAuthStore";

export interface PartyLite {
  id: string;
  name: string;
  mobile?: string;
  gstin?: string;
  defaultStation?: string;
  defaultPaymentMode?: string;
}

export async function loadPartyOptions(q: string): Promise<Option<string>[]> {
  const res = await apiClient.get<Envelope<PartyLite[]>>("/parties", {
    params: { search: q || undefined, limit: 30 },
  });
  return (res.data.data || []).map((p) => ({
    value: p.id,
    label: p.name,
    hint: [p.mobile, p.defaultStation].filter(Boolean).join(" · ") || undefined,
  }));
}

export interface Station {
  id: string;
  code: string;
  name: string;
  state?: string;
  isActive: boolean;
}

export async function loadStationOptions(q: string): Promise<Option<string>[]> {
  const res = await apiClient.get<Envelope<Station[]>>("/stations", {
    params: { search: q || undefined },
  });
  return (res.data.data || []).map((s) => ({
    value: s.code,
    label: `${s.code} — ${s.name}`,
    hint: s.state,
  }));
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  stationCode?: string;
  address?: string;
  phone?: string;
  isHeadOffice: boolean;
  isActive: boolean;
}

export function useBranches(includeInactive = false) {
  return useApiGet<Branch[]>(["branches"], "/branches", {
    includeInactive: includeInactive || undefined,
  });
}

export interface BusinessProfile {
  _id: string;
  businessName: string;
  tagline?: string;
  gstin: string;
  pan?: string;
  mobileNumbers?: string[];
  officeAddress: string;
  godownAddress?: string;
  jurisdiction?: string;
  liabilityLimit?: number;
  bankName?: string;
  bankAccountNumber?: string;
  bankIFSC?: string;
  bankBranch?: string;
  defaultCgstRate?: number;
  defaultSgstRate?: number;
  billNumberPrefix?: string;
  useFinancialYearPrefix?: boolean;
  nextBillNumber?: number;
  nextPodNumber?: number;
  podNumberPrefix?: string;
  brandColor?: string;
  logoDataUrl?: string | null;
  paymentReceivers?: string[];
  backupEmail?: string;
  logoUrl?: string | null;
}

export function useBusinessProfile() {
  return useApiGet<BusinessProfile>(["business-profile"], "/business-profile");
}

export interface Me extends User {
  organization: Organization;
  subscription: Subscription;
}

export function useMe() {
  return useApiGet<Me>(["me"], "/auth/me", undefined, { staleTime: 30_000 });
}
