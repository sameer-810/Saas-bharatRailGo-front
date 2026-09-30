/**
 * Thin React Query helpers over apiClient. Every screen uses these so query
 * keys, envelopes and cache invalidation behave the same everywhere.
 *
 *   const list = useApiList<Party>("parties", "/parties", { page, limit: 20, search });
 *   const one  = useApiGet<Party>(["parties", id], `/parties/${id}`);
 *   const save = useApiMutation<Party, PartyInput>("post", "/parties", { invalidate: ["parties"] });
 *   await save.mutateAsync(body);
 *
 * Query keys start with the resource name so invalidate: ["parties"] refreshes
 * every list/detail of that resource. The branch id is part of every key, so
 * switching branch re-fetches everything automatically.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  apiClient,
  cleanParams,
  type Envelope,
  type Paging,
} from "./apiClient";
import { useBranchStore } from "../store/useBranchStore";

export interface ListResult<T> {
  items: T[];
  meta: Paging;
}

function useBranchKey() {
  return useBranchStore((s) => s.branchId);
}

/** Paged list endpoint → { items, meta }. */
export function useApiList<T>(
  resource: string,
  url: string,
  params?: Record<string, unknown>,
  options?: Partial<UseQueryOptions<ListResult<T>>>,
) {
  const branch = useBranchKey();
  return useQuery<ListResult<T>>({
    queryKey: [resource, "list", url, cleanParams(params), branch],
    queryFn: async () => {
      const res = await apiClient.get<Envelope<T[]>>(url, {
        params: cleanParams(params),
      });
      const items = res.data.data ?? [];
      const meta = (res.data.meta as Paging) ?? {
        total: items.length,
        page: 1,
        limit: items.length,
        totalPages: 1,
      };
      return { items, meta };
    },
    placeholderData: (prev) => prev,
    ...options,
  });
}

/** Any GET returning { data }. `key` should start with the resource name. */
export function useApiGet<T>(
  key: unknown[],
  url: string | null,
  params?: Record<string, unknown>,
  options?: Partial<UseQueryOptions<T>>,
) {
  const branch = useBranchKey();
  return useQuery<T>({
    queryKey: [...key, cleanParams(params), branch],
    queryFn: async () => {
      const res = await apiClient.get<Envelope<T>>(url as string, {
        params: cleanParams(params),
      });
      return res.data.data;
    },
    enabled: !!url,
    ...options,
  });
}

type Method = "post" | "patch" | "put" | "delete";

/**
 * Mutation → returns the envelope's data. `url` may be a function of the
 * variables, e.g. (v) => `/pods/${v.id}/status`.
 */
export function useApiMutation<TData = unknown, TVars = unknown>(
  method: Method,
  url: string | ((vars: TVars) => string),
  opts: { invalidate?: string[]; body?: (vars: TVars) => unknown } = {},
) {
  const qc = useQueryClient();
  return useMutation<TData, unknown, TVars>({
    mutationFn: async (vars) => {
      const target = typeof url === "function" ? url(vars) : url;
      const body = opts.body ? opts.body(vars) : vars;
      const res =
        method === "delete"
          ? await apiClient.delete<Envelope<TData>>(target)
          : await apiClient[method]<Envelope<TData>>(target, body);
      return res.data?.data as TData;
    },
    onSuccess: async () => {
      await Promise.all(
        (opts.invalidate || []).map((k) =>
          qc.invalidateQueries({ queryKey: [k] }),
        ),
      );
      // Usage counters (bookings this month, users) live in /auth/me.
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
