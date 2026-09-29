import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { StateStorage } from "zustand/middleware";

/**
 * Tokens live in the OS keychain on Android/iOS and in localStorage on web
 * (the only persistent option a static web build has).
 */
export const secureStorage: StateStorage = {
  getItem: async (name) => {
    if (Platform.OS === "web") return globalThis.localStorage?.getItem(name) ?? null;
    return SecureStore.getItemAsync(name);
  },
  setItem: async (name, value) => {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(name, value);
    else await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name) => {
    if (Platform.OS === "web") globalThis.localStorage?.removeItem(name);
    else await SecureStore.deleteItemAsync(name);
  },
};
