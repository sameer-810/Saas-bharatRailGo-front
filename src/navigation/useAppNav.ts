import { useNavigation, useRoute } from "@react-navigation/native";
import type { AppRoute, AdminRoute } from "./routes";

type Nav<R extends string> = {
  navigate: (route: R, params?: Record<string, unknown>) => void;
  replace?: (route: R, params?: Record<string, unknown>) => void;
  goBack: () => void;
  canGoBack: () => boolean;
  setParams: (params: Record<string, unknown>) => void;
};

/** Navigation for tenant screens: nav.navigate("BookingDetail", { id }). */
export function useAppNav() {
  return useNavigation() as unknown as Nav<AppRoute>;
}

export function useAdminNav() {
  return useNavigation() as unknown as Nav<AdminRoute>;
}

/** Route params, e.g. const { id } = useParams<{ id: string }>(); */
export function useParams<P extends Record<string, unknown>>(): Partial<P> {
  return (useRoute().params || {}) as Partial<P>;
}
