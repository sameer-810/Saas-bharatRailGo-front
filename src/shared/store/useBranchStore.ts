/**
 * The branch the user is working in. Sent as X-Branch-Id on every request
 * (apiClient). "all" = every branch the user may see (owner/manager default).
 * Changing it invalidates every cached query so all screens re-fetch.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { secureStorage } from "./secureStorage";

interface BranchState {
  branchId: string; // ObjectId or "all"
  setBranchId: (id: string) => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      branchId: "all",
      setBranchId: (branchId) => set({ branchId }),
    }),
    {
      name: "bharatrailgo-branch",
      storage: createJSONStorage(() => secureStorage),
    },
  ),
);
