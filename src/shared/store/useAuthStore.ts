/**
 * Tenant session: tokens, user, organization and the subscription summary
 * (plan, limits, usage, trial/grace/read-only state) the server returns at
 * login and from /auth/me.
 *
 * Access tokens live 15 minutes; refreshSession() rotates them with the
 * refresh token. Only a 401/403 from /auth/refresh ends the session — a
 * network error keeps it for the next attempt.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import axios from "axios";
import { environment } from "@config/env";
import { secureStorage } from "./secureStorage";

export type Role = "owner" | "manager" | "staff";

export interface User {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: Role;
  branches: string[];
  isActive: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface Limits {
  maxUsers: number | null;
  maxBranches: number | null;
  maxBookingsPerMonth: number | null;
}

export interface Subscription {
  status: "none" | "trial" | "active" | "past_due" | "cancelled";
  state: "ok" | "grace" | "expired";
  readOnly: boolean;
  planCode: string | null;
  planName: string | null;
  billingCycle: string | null;
  endsAt: string | null;
  graceEndsAt: string | null;
  daysLeft: number | null;
  limits: Limits;
  usage: { users: number; branches: number; bookingsThisMonth: number };
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  organization: Organization | null;
  subscription: Subscription | null;
  /** Last X-Subscription-State header seen — drives the banner between /me calls. */
  liveSubscriptionState: "ok" | "grace" | "expired" | null;
  isHydrated: boolean;
  isAuthChecked: boolean;

  setSession: (p: {
    accessToken: string;
    refreshToken: string;
    user: User;
    organization: Organization;
    subscription?: Subscription | null;
  }) => void;
  setMe: (p: {
    user: User;
    organization: Organization;
    subscription: Subscription;
  }) => void;
  setLiveSubscriptionState: (s: "ok" | "grace" | "expired" | null) => void;
  refreshSession: () => Promise<string | null>;
  initialize: () => Promise<void>;
  logout: () => Promise<void>;
}

let refreshPromise: Promise<string | null> | null = null;

function tokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(globalThis.atob ? globalThis.atob(part) : "{}");
    return !json.exp || json.exp * 1000 < Date.now() + 20_000;
  } catch {
    return true;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,
      organization: null,
      subscription: null,
      liveSubscriptionState: null,
      isHydrated: false,
      isAuthChecked: false,

      setSession: ({
        accessToken,
        refreshToken,
        user,
        organization,
        subscription,
      }) =>
        set({
          token: accessToken,
          refreshToken,
          user,
          organization,
          subscription: subscription ?? get().subscription,
          liveSubscriptionState: subscription?.state ?? null,
        }),

      setMe: ({ user, organization, subscription }) =>
        set({
          user,
          organization,
          subscription,
          liveSubscriptionState: subscription.state,
        }),

      setLiveSubscriptionState: (s) => {
        if (s !== get().liveSubscriptionState)
          set({ liveSubscriptionState: s });
      },

      refreshSession: async () => {
        if (refreshPromise) return refreshPromise;
        refreshPromise = (async () => {
          const { refreshToken } = get();
          if (!refreshToken) return null;
          try {
            const res = await axios.post(`${environment.apiUrl}/auth/refresh`, {
              refreshToken,
            });
            const { accessToken, refreshToken: next } = res.data.data;
            set({ token: accessToken, refreshToken: next });
            return accessToken as string;
          } catch (err) {
            const status = (err as { response?: { status?: number } })?.response
              ?.status;
            if (status === 401 || status === 403) await get().logout();
            return null;
          } finally {
            refreshPromise = null;
          }
        })();
        return refreshPromise;
      },

      initialize: async () => {
        const { token, refreshToken, refreshSession } = get();
        if (token && !tokenExpired(token)) {
          set({ isAuthChecked: true });
          return;
        }
        if (refreshToken) await refreshSession();
        set({ isAuthChecked: true });
      },

      logout: async () => {
        const { refreshToken } = get();
        if (refreshToken) {
          axios
            .post(`${environment.apiUrl}/auth/logout`, { refreshToken })
            .catch(() => undefined);
        }
        set({
          token: null,
          refreshToken: null,
          user: null,
          organization: null,
          subscription: null,
          liveSubscriptionState: null,
        });
      },
    }),
    {
      name: "bharatrailgo-auth",
      storage: createJSONStorage(() => secureStorage),
      partialize: (s) => ({
        token: s.token,
        refreshToken: s.refreshToken,
        user: s.user,
        organization: s.organization,
        subscription: s.subscription,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ isHydrated: true });
      },
    },
  ),
);

/** Convenience selectors. */
export const useIsAuthenticated = () =>
  useAuthStore((s) => !!s.token && !!s.user);
export const useRole = () => useAuthStore((s) => s.user?.role ?? "staff");
