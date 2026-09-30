/**
 * API endpoints. Set EXPO_PUBLIC_API_URL_DEV / EXPO_PUBLIC_API_URL in .env.
 * On an Android emulator, localhost is the emulator itself — use 10.0.2.2.
 */
const ENV = {
  development: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL_DEV || "http://localhost:5001/api",
  },
  production: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:5001/api",
  },
};

export const environment = __DEV__ ? ENV.development : ENV.production;

/** Public marketing site (landing/) — Terms and Privacy Policy live there. */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || "https://saas-bharat-rail-go-web.vercel.app").replace(/\/$/, "");
