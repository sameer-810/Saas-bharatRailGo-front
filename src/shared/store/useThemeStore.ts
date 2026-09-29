/**
 * Theme preference (system / light / dark) and the tenant brand colour that
 * becomes the app accent. The brand colour is loaded from the business
 * profile after login (AppShell) and cleared on logout.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { secureStorage } from "./secureStorage";

export type ThemePreference = "system" | "light" | "dark";

interface ThemeState {
  preference: ThemePreference;
  brandColor: string | null;
  setPreference: (p: ThemePreference) => void;
  setBrandColor: (c: string | null) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: "system",
      brandColor: null,
      setPreference: (preference) => set({ preference }),
      setBrandColor: (brandColor) => set({ brandColor }),
    }),
    { name: "bharatrailgo-theme", storage: createJSONStorage(() => secureStorage) },
  ),
);
