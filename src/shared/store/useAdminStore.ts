/**
 * Platform super-admin session — completely separate from the tenant session
 * (own token, own storage key). Reached at /admin.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { secureStorage } from "./secureStorage";

export interface PlatformAdmin {
  id: string;
  name: string;
  email: string;
}

interface AdminState {
  token: string | null;
  admin: PlatformAdmin | null;
  setSession: (token: string, admin: PlatformAdmin) => void;
  logout: () => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      token: null,
      admin: null,
      setSession: (token, admin) => set({ token, admin }),
      logout: () => set({ token: null, admin: null }),
    }),
    { name: "bharatrailgo-admin", storage: createJSONStorage(() => secureStorage) },
  ),
);
