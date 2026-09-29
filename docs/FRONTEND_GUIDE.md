# BharatRailGo front: module guide

This is an Expo app (React Native + react-native-web): one codebase that runs on web, Android and iOS.
Read this guide before building a module.

## Ground rules

1. **Stay inside your module folder** (`src/modules/<name>/`). Never edit `src/shared/**`,
   `src/navigation/**`, `App.tsx` or another module. If you need a helper, put it in your module.
2. **Keep the keys of the screens object in `src/modules/<name>/index.ts` exactly as they are.**
   Each key is a route name, and navigation imports only that object. Replace the `Placeholder`
   values with your real screen components.
3. **All UI comes from `@shared/ui`** and all colours from `useTheme()`. Never hard-code hex colours.
   Green, amber and red are for status only; `StatusPill` does that for you.
4. **All HTTP goes through `@shared/api`**: `useApiList`, `useApiGet`, `useApiMutation` and `apiClient`.
   Never use `fetch` or a separate axios instance.
5. **Every interactive element gets a stable `testID`**, for example `booking-save`,
   `booking-row-<id>` or `party-search`. Playwright drives the web build through these, and on web
   they render as `data-testid`.
6. The app must run on a 390 px phone and a 1440 px desktop. `useLayout()` gives you
   `isPhone`, `isTablet` and `isDesktop`. `DataList` already switches between a table and cards.
7. **Typecheck before finishing.** Run `npx tsc --noEmit` from `bharatrailgo-front/`. Your module must
   produce zero errors; errors in other modules are not yours.
8. Money uses `<Money value={…} />` (₹, en-IN, tabular). Dates use `formatDate` or `formatDateTime`
   from `@shared/lib/format`. The API takes dates as `YYYY-MM-DD` (`isoDay()`).
9. After any mutation, `toast.success(...)`. On error, `toast.error(apiErrorMessage(err))`. Before a
   destructive action, `await confirm({ title, message, danger: true })`.
10. Hide actions the role cannot use with `useCan("records.delete")` and similar. When
    `useReadOnly()` is true (expired subscription), disable create/edit buttons and show why.

## Imports cheat-sheet

```ts
import { Screen, Card, Row, Col, Text, Button, IconButton, TextField, NumberField, SearchInput,
  Select, Combobox, DateField, SegmentedControl, Toggle, Chip, StatusPill, Money, Badge,
  DataList, type Column, KeyValue, StatTile, SectionHeader, EmptyState, ErrorState, LoadingBlock,
  Banner, Dialog, Divider, toast, confirm, Board, BoardText, FlapText, humanize } from "@shared/ui";
import { useTheme, useLayout } from "@shared/useTheme";
import { useApiList, useApiGet, useApiMutation } from "@shared/api/query";
import { apiClient, apiErrorMessage, apiErrorCode } from "@shared/api/apiClient";
import { openPdf, downloadFile } from "@shared/api/files";
import { loadPartyOptions, loadStationOptions, useBranches, useBusinessProfile, useMe } from "@shared/api/lookups";
import { useCan, useReadOnly } from "@shared/lib/permissions";
import { formatMoney, formatDate, formatDateTime, isoDay, addDays, startOfMonth } from "@shared/lib/format";
import { useDebounced } from "@shared/hooks/useDebounced";
import { useAppNav, useParams } from "@navigation/useAppNav";   // admin screens: useAdminNav
import { useAuthStore } from "@shared/store/useAuthStore";
```

Read the component source in `src/shared/ui/*.tsx` for the exact props. The files are short.

## Data patterns

```ts
const [page, setPage] = useState(1);
const [search, setSearch] = useState("");
const q = useDebounced(search);
const list = useApiList<Party>("parties", "/parties", { page, limit: 20, search: q });
// list.data?.items, list.data?.meta, list.isLoading, list.error, list.refetch

const one = useApiGet<Party>(["parties", id], id ? `/parties/${id}` : null);

const create = useApiMutation<Party, PartyInput>("post", "/parties", { invalidate: ["parties"] });
const update = useApiMutation<Party, PartyInput>("patch", `/parties/${id}`, { invalidate: ["parties"] });
const remove = useApiMutation("delete", (v: { id: string }) => `/parties/${v.id}`, { invalidate: ["parties"] });
```

- The first element of a query key is the resource name: `parties`, `consignments`, `pods`,
  `payments`, `invoices`, `reports`, `dashboard`, `branches`, `stations`, `charge-heads`, `users`,
  `business-profile`, `me`. Invalidate every resource your mutation affects. For example, a payment
  changes `payments`, `consignments`, `parties`, `dashboard` and `reports`.
- Forms: use `react-hook-form` + `zod` with `@hookform/resolvers/zod`. See
  `src/modules/auth/SignupScreen.tsx` for the `Controller` pattern.
- The response envelope is `{ success, data, meta }`. The helpers unwrap it. Lists return
  `meta = { total, page, limit, totalPages }`.
- Errors come back as `{ error: { code, message, details } }`. Use `apiErrorMessage(err)` for the
  message and `apiErrorCode(err)` to branch. Codes you will meet: `PLAN_LIMIT_REACHED`,
  `SUBSCRIPTION_EXPIRED`, `INVALID_PAYMENT_RECEIVER`, `FORBIDDEN`, `BRANCH_FORBIDDEN`,
  `VALIDATION_ERROR`.

## Navigation

`const nav = useAppNav(); nav.navigate("BookingDetail", { id })`. Route names and URL paths are in
`src/navigation/routes.ts`. Detail and edit routes take `{ id }`. The `*New` routes accept an
optional `{ partyId }` to pre-select a party. Use `<Screen title back backTo="Bookings" actions={…}>`
as the root of every screen.

## Backend contract

The API lives in `../bharatrailgo-back`. It is the source of truth, so read it:

- Routes: `bharatrailgo-back/src/routes/index.js` and `src/modules/<name>/<name>.routes.js`
- Request bodies and query params: `src/modules/<name>/<name>.validation.js` (zod). Unknown keys are
  dropped.
- Response shapes: `src/modules/<name>/<name>.dto.js`. Every id is `id`, not `_id`, except the
  business profile, which is returned raw.
- Business rules: `src/modules/<name>/<name>.service.js`

The base URL already includes `/api`, so call `"/parties"`, not `"/api/parties"`.

## Visual language ("Railway Signal")

- Calm surfaces, strong hierarchy, and one accent (the tenant's brand colour, `t.c.accent`).
- Use monospace (`t.fonts.mono`) for money, bilti and bill numbers, station codes, train and bogie
  numbers, and RR numbers.
- The departure-board components (`Board`, `FlapText`, `BoardText`) are the product's signature.
  Use them where live operations are shown, and don't sprinkle them everywhere.
- Show only what the next decision needs (progressive disclosure), and put details behind a tap.
- Every list needs a good empty state with the primary action in it.
