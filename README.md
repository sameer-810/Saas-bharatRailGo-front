# BharatRailGo: app (web, Android, iOS)

This is one Expo codebase: React Native 0.85 + react-native-web.

```bash
cp .env.example .env              # EXPO_PUBLIC_API_URL_DEV=http://localhost:5001/api
npm install
npm run web                       # dev server in the browser
npm run android                   # device or emulator (use 10.0.2.2 instead of localhost on the emulator)
npm run typecheck && npm run lint
npm test                          # unit tests (quick-entry parser)
npm run verify                    # full Playwright end-to-end gate → ../verify-evidence/phase4/
node tools/devStack.mjs           # local stack: seeded in-memory DB + API :5099 + web :8099
```

## Layout

```
App.tsx                      fonts, React Query, URL routing, theme
src/config/env.ts            API base URL
src/navigation/              Root / App / Admin navigators, AppShell (sidebar, top bar,
                             branch switcher, subscription banner, bottom tabs),
                             CommandPalette (Ctrl/⌘K), routes.ts (route → URL), navItems.ts
src/shared/theme.ts          "Railway Signal" design tokens; the accent is the tenant's brand colour
src/shared/ui/               primitives, controls, layout, feedback (toast/confirm), board (split-flap)
src/shared/api/              apiClient (refresh, X-Branch-Id), adminApiClient, query hooks, files (PDF/Excel), lookups
src/shared/store/            auth, branch, theme, admin (zustand, persisted in the keychain / localStorage)
src/modules/<feature>/       screens/, components/, index.ts (the only public surface)
tools/                       devStack, verifyAll, verifyFlows (Playwright)
docs/FRONTEND_GUIDE.md       conventions every module follows
```

Modules: auth, dashboard (departure board), bookings (quick entry, loading list), bilti,
parties (ledger), payments (FIFO preview), invoices (GST), reports (Excel export), settings
(business, branding, team, branches, stations, rate card, plan), admin (platform console at `/admin`).
