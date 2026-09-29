# UI/UX direction (research, 2026-09-24) — built in Phase 4

## What 2026 research says wins in B2B ops apps

- **Calm UI + progressive disclosure** — show only what the next decision needs; reveal detail on demand.
- **Role-based home screens** — owner, manager, booking clerk and godown staff see different first screens.
- **Command palette (Ctrl/⌘ K)** — every action and record reachable by typing. Now expected in any SaaS with 10+ features.
- **Field-staff mobile rules** — high contrast, big thumb targets, minimal taps, works in poor light and poor network.
- **Speed is UX** — under 2 s load; optimistic updates; offline outbox.
- **Colour means status**, and nothing else.

## What will make this product look like nothing agents have seen

1. **Departure-board home screen.** Today's bookings as a split-flap railway board, one row per train or
   destination: bogie, packages, status (Received → Loaded → In transit → Unloaded → Delivered).
   Agents live by train schedules, so the screen speaks their world.
2. **Type-a-bilti bar.** One line such as `DLI 3pkg 60kg Sharma Traders topay 1550` is parsed into a full
   consignment, with a live preview of the printed bilti next to it. Keyboard-first like Linear, and
   faster than a paper register.
3. **Hindi and Hinglish voice entry** on mobile for godown staff ("teen packet Delhi Sharma ka").
4. **Parcel journey timeline** per bilti, in the style of a train route, shareable to WhatsApp as an
   image or link for the consignee.
5. **Money strip.** A persistent thin bar showing "Aaj ka collection / To-pay pending / On-bill due".
   Tap it to drill down.
6. **Ctrl K everywhere.** "new bilti", "party Sharma", "bill 2601", "mark 26500 delivered".
7. **Onboarding in under 15 minutes.** Sample data, import of parties from Excel or Tally, and a
   guided first bilti.
8. **Offline-first godown mode.** Bookings queue while offline and sync later, following the
   inventory-saas outbox pattern.

Visual language: warm off-white or deep-ink themes, one railway-signal accent colour
(green/amber/red used only for status), tabular numerals for money, and generous 44 px+ touch
targets on mobile.

Sources: procreator.design (B2B SaaS trends 2026), saasui.design (7 SaaS UI trends 2026, command
palette patterns), buildmvpfast.com (Cmd+K in SaaS 2026), phenomenonstudio.com and cieden.com
(logistics UX).
