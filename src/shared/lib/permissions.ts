/**
 * Mirror of the backend permission matrix (bharatrailgo-back/src/config/roles.js).
 * The UI only hides what the server would refuse anyway — the server is the
 * authority.
 */
import { useAuthStore, type Role } from "../store/useAuthStore";

const PERMISSIONS: Record<string, Role[]> = {
  "settings.manage": ["owner"],
  "branches.manage": ["owner"],
  "users.manage": ["owner", "manager"],
  "users.manageManagers": ["owner"],
  "masters.manage": ["owner", "manager"],
  "records.delete": ["owner", "manager"],
  "billing.manage": ["owner"],
  "audit.view": ["owner", "manager"],
  "privacy.manage": ["owner", "manager"],
  "account.manage": ["owner"],
};

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined, permission: Permission): boolean {
  return !!role && (PERMISSIONS[permission] || []).includes(role);
}

/** Hook: const allowed = useCan("records.delete"); */
export function useCan(permission: Permission): boolean {
  return useAuthStore((s) => can(s.user?.role, permission));
}

/** True when the subscription is read-only (writes will return 402). */
export function useReadOnly(): boolean {
  return useAuthStore((s) => s.liveSubscriptionState === "expired" || !!s.subscription?.readOnly);
}
