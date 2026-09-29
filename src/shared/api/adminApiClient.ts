/**
 * Platform super-admin API client (/api/admin). Separate token; a 401 signs
 * the admin out (admin tokens are not refreshed — they last one working day).
 */
import axios from "axios";
import { environment } from "@config/env";
import { useAdminStore } from "../store/useAdminStore";

export const adminApiClient = axios.create({
  baseURL: `${environment.apiUrl}/admin`,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

adminApiClient.interceptors.request.use((config) => {
  const token = useAdminStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminApiClient.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes("/auth/login")) {
      useAdminStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
