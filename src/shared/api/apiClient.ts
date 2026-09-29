/**
 * Tenant API client.
 *  - Authorization: Bearer <access token>
 *  - X-Branch-Id: the branch picked in the top bar (omitted for "all")
 *  - 401 → one single-flight refresh, then the request is retried once
 *  - X-Subscription-State response header → auth store (drives the banner)
 */
import axios, { type InternalAxiosRequestConfig } from "axios";
import { environment } from "@config/env";
import { useAuthStore } from "../store/useAuthStore";
import { useBranchStore } from "../store/useBranchStore";

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const apiClient = axios.create({
  baseURL: environment.apiUrl,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const branchId = useBranchStore.getState().branchId;
  if (branchId && branchId !== "all") config.headers["X-Branch-Id"] = branchId;
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const state = response.headers?.["x-subscription-state"];
    if (state) useAuthStore.getState().setLiveSubscriptionState(state);
    return response;
  },
  async (error) => {
    const original = error.config as RetryConfig | undefined;
    const status = error.response?.status;

    // Picked branch no longer allowed (removed from the user, deactivated) → fall back to all.
    if (status === 403 && apiErrorCode(error) === "BRANCH_FORBIDDEN" && original && !original._retry) {
      useBranchStore.getState().setBranchId("all");
      original._retry = true;
      delete original.headers["X-Branch-Id"];
      return apiClient(original);
    }

    if (status === 401 && original && !original._retry && !original.url?.includes("/auth/")) {
      original._retry = true;
      const token = await useAuthStore.getState().refreshSession();
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      }
    }
    return Promise.reject(error);
  },
);

type ApiErrorBody = {
  response?: {
    status?: number;
    data?: {
      error?: {
        code?: string;
        message?: string;
        details?: unknown;
      };
    };
  };
};

/** Server's machine-readable error code (e.g. PLAN_LIMIT_REACHED). Branch on this, not on text. */
export function apiErrorCode(err: unknown): string | undefined {
  return (err as ApiErrorBody)?.response?.data?.error?.code;
}

export function apiErrorStatus(err: unknown): number | undefined {
  return (err as ApiErrorBody)?.response?.status;
}

/** Human message, including the first few validation issues when present. */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  const e = (err as ApiErrorBody)?.response?.data?.error;
  if (!e) {
    if ((err as { message?: string })?.message === "Network Error") {
      return "Cannot reach the server. Check your internet connection.";
    }
    return (err instanceof Error && err.message) || fallback;
  }
  const details = e.details as { path?: string; message?: string }[] | undefined;
  if (Array.isArray(details) && details.length) {
    const parts = details
      .slice(0, 3)
      .map((d) => `${String(d.path || "").replace(/^(body|query|params)\./, "")}: ${d.message}`);
    return `${e.message || fallback} — ${parts.join(" · ")}`;
  }
  return e.message || fallback;
}

/** The standard { success, data, meta } envelope. */
export interface Envelope<T> {
  success: boolean;
  data: T;
  meta?: Paging & Record<string, unknown>;
  message?: string;
}

export interface Paging {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

/** Drop empty values so they are not sent as query params. */
export function cleanParams(params?: Record<string, unknown>) {
  if (!params) return undefined;
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
}
