/**
 * Admin-local data hooks. The platform console talks to /api/admin through
 * adminApiClient (its own token), so it must NOT use the tenant helpers in
 * @shared/api/query. Every query key starts with "admin" so one
 * invalidateQueries({ queryKey: ["admin"] }) refreshes the whole console.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApiClient } from "@shared/api/adminApiClient";
import { cleanParams, type Envelope, type Paging } from "@shared/api/apiClient";

/* ─────────────────────────── Types (mirror backend DTOs) ─────────────────────────── */

export type ApprovalStatus = "pending" | "approved" | "rejected";
export type OrgStatus = "active" | "suspended";
export type SubStatus = "none" | "trial" | "active" | "past_due" | "cancelled";
export type SubState = "ok" | "grace" | "expired";
export type BillingCycle = "monthly" | "yearly";

export interface Limits {
  maxUsers: number | null;
  maxBranches: number | null;
  maxBookingsPerMonth: number | null;
}

export interface SubscriptionState {
  status: SubStatus;
  planCode: string | null;
  billingCycle: BillingCycle | null;
  state: SubState;
  readOnly: boolean;
  endsAt: string | null;
  graceEndsAt: string | null;
  daysLeft: number | null;
}

export interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  gstin?: string | null;
  email?: string | null;
  mobile?: string | null;
  city?: string | null;
  approvalStatus: ApprovalStatus;
  rejectionReason?: string | null;
  approvedAt?: string | null;
  status: OrgStatus;
  suspendedReason?: string | null;
  subscriptionState: SubscriptionState;
  limitsOverride: Limits;
  /** Owner asked to close the account (DPDP); purge allowed from purgeAllowedFrom. */
  deletion: { requestedAt: string | null; purgeAllowedFrom: string | null; graceDays: number; reason: string | null };
  consent: { termsVersion: string; acceptedAt: string } | null;
  createdAt: string;
}

export interface AdminOrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string | null;
}

export interface SubscriptionSummary extends SubscriptionState {
  planName: string | null;
  limits: Limits;
  usage: { users: number; branches: number; bookingsThisMonth: number; periodStart: string };
}

export interface AdminOrgDetail extends AdminOrg {
  owner: { id: string; name: string; email: string } | null;
  users: AdminOrgUser[];
  subscription: SubscriptionSummary;
}

export interface AdminDashboard {
  organizations: {
    total: number;
    pending: number;
    suspended: number;
    trial: number;
    active: number;
    pastDue: number;
    trialsEndingSoon: number;
  };
  mrr: number;
  arr: number;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  limits: Limits;
  isTrial: boolean;
  isPublic: boolean;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
}

export type PlanInput = Partial<Omit<Plan, "id">>;

/** Raw PlatformAudit doc (the backend returns it without a DTO). */
export interface AuditEntry {
  _id: string;
  admin: string;
  adminEmail?: string;
  action: string;
  organization?: { _id: string; name: string; slug?: string } | null;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown> | null;
  createdAt: string;
}

export interface Paged<T> {
  items: T[];
  meta: Paging;
}

export interface SubscriptionPatch {
  planCode?: string;
  status?: Exclude<SubStatus, "none">;
  billingCycle?: BillingCycle | null;
  trialEndsAt?: string | null;
  currentPeriodEndsAt?: string | null;
  periodDays?: number;
  extendTrialDays?: number;
}

/* ─────────────────────────── Helpers ─────────────────────────── */

async function getData<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await adminApiClient.get<Envelope<T>>(url, { params: cleanParams(params) });
  return res.data.data;
}

async function getPaged<T>(url: string, params?: Record<string, unknown>): Promise<Paged<T>> {
  const res = await adminApiClient.get<Envelope<T[]>>(url, { params: cleanParams(params) });
  const items = res.data.data ?? [];
  const meta = (res.data.meta as Paging) ?? { total: items.length, page: 1, limit: items.length, totalPages: 1 };
  return { items, meta };
}

/* ─────────────────────────── Queries ─────────────────────────── */

export function useAdminDashboard() {
  return useQuery({ queryKey: ["admin", "dashboard"], queryFn: () => getData<AdminDashboard>("/dashboard") });
}

export interface OrgListParams {
  search?: string;
  approvalStatus?: ApprovalStatus;
  status?: OrgStatus;
  subscriptionStatus?: SubStatus;
  deletionRequested?: "true";
  page?: number;
  limit?: number;
}

export function useAdminOrgs(params: OrgListParams) {
  return useQuery({
    queryKey: ["admin", "organizations", "list", cleanParams({ ...params })],
    queryFn: () => getPaged<AdminOrg>("/organizations", { ...params }),
    placeholderData: (prev) => prev,
  });
}

export function useAdminOrg(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "organizations", "detail", id],
    queryFn: () => getData<AdminOrgDetail>(`/organizations/${id}`),
    enabled: !!id,
  });
}

export function useAdminPlans() {
  return useQuery({ queryKey: ["admin", "plans"], queryFn: () => getData<Plan[]>("/plans") });
}

export function useAdminAudit(params: { organization?: string; action?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ["admin", "audit", cleanParams({ ...params })],
    queryFn: () => getPaged<AuditEntry>("/audit", { ...params }),
    placeholderData: (prev) => prev,
  });
}

/* ─────────────────────────── Mutations ─────────────────────────── */

/** Generic admin mutation; invalidates every "admin" query on success. */
export function useAdminMutation<V, R = unknown>(fn: (vars: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation<R, unknown, V>({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

type Msg<T> = { data: T; message?: string };

async function send<T>(method: "post" | "patch", url: string, body?: unknown): Promise<Msg<T>> {
  const res = await adminApiClient[method]<Envelope<T>>(url, body ?? {});
  return { data: res.data.data, message: res.data.message };
}

export const adminActions = {
  approve: (id: string) => send<AdminOrg>("post", `/organizations/${id}/approve`),
  reject: (id: string, reason: string) => send<AdminOrg>("post", `/organizations/${id}/reject`, { reason }),
  suspend: (id: string, reason: string) => send<AdminOrg>("post", `/organizations/${id}/suspend`, { reason }),
  reactivate: (id: string) => send<AdminOrg>("post", `/organizations/${id}/reactivate`),
  revokeSessions: (id: string) => send<{ revoked: number }>("post", `/organizations/${id}/revoke-sessions`),
  updateSubscription: (id: string, body: SubscriptionPatch) =>
    send<AdminOrg>("patch", `/organizations/${id}/subscription`, body),
  updateLimits: (id: string, body: Limits) => send<AdminOrg>("patch", `/organizations/${id}/limits`, body),
  createPlan: (body: PlanInput) => send<Plan>("post", "/plans", body),
  updatePlan: (id: string, body: PlanInput) => send<Plan>("patch", `/plans/${id}`, body),
  purge: (id: string, confirmSlug: string) =>
    send<{ organization: { id: string; name: string; slug: string }; deleted: Record<string, number> }>(
      "post",
      `/organizations/${id}/purge`,
      { confirmSlug },
    ),
};
