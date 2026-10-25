# Tempo V2 — web and native mobile

This repository is the canonical implementation for the old Tempo and V2 projects. Web/API: src. Native Android/iOS: mobile. Shared API contracts: shared. See [consolidation and setup](docs/V2_CONSOLIDATION.md) and [mobile instructions](mobile/README.md).

# Tempo

See [current implementation status](IMPLEMENTATION_STATUS.md) for the October 24 fixes, new calendar features, verification results, and remaining work.

Production calendar built from `tempo-construction-notebook` + `tempo-agenda.html` prototype.

**Stack:** Next.js 15 + TypeScript + Supabase Auth/Postgres + Prisma (server-only) + TanStack Query + Zod.

## What's implemented

**Auth & tenancy (Notebook v3 §2.1):**
* Supabase Auth (`src/lib/supabase/{server,browser}.ts`, `middleware.ts` token refresh, `src/app/auth/callback/route.ts`)
* `/login` (email/password + Google OAuth `signInWithOAuth`)
* Server resolver `src/app/page.tsx` → `resolveDefaultWorkspace` / `ensureDefaultWorkspaceForUser` (`src/server/services/workspace-service.ts`) — never trusts client `workspaceId`; auto-creates `UserProfile` + `Workspace` + `Membership owner` + 4 calendars (`Work`/`Personal`/`Study`/`Health`) idempotently inside a transaction
* Supabase authentication and the database are required; no demo bypass is available.

**Domain:**
* `prisma/schema.prisma` — `UserProfile`, `Workspace` (`slug` unique), `Membership` (`owner|admin|member|viewer`, `@@unique(workspace,member)`), `Calendar` (`is_default` partial unique index), `Event` (`timestamptz` + `timezone` + `allDay` + `deletedAt` soft-delete), `RecurrenceRule`, `Attendee`, `Reminder`, `AuditLog`
* `src/server/services` + `repositories` — `UI → hooks/API → route → service (authz) → repository → Prisma` boundary; every service asserts `assertWorkspaceMember` / `assertCanWriteWorkspace` / `assertCanManageCalendar(s)`

**Calendar product (prototype parity):**
* `src/features/calendar/components/CalendarShell.tsx` — Day/Week/Month/Agenda (same `useCalendarEvents` query), debounced search `q`, calendar filter with correct empty handling, keyboard shortcuts `t/d/w/m/a/c/j/k/Arrow` + `/`
* `TimeGrid` — `layoutDay` overlap, civil-day segmentation (`src/features/calendar/lib/event-segmentation.ts` `segmentEventsForDays` + `layoutSegments` — no fake `EventRecord` timezone bug), `tg-all` all-day chips (multi-day aware), `col today` + `now` line, drag column move (horizontal `startX` → target `data-day`) + vertical snap 15m, cross-midnight duration via `durationMs`, **resize disabled when `startK !== endK`**
* `MonthView` / `AgendaView` — `Mon-Sun` grid 42 cells, `chip` 3 + `more` + `dots` (mobile), `empty` state, agenda `Next 30 days` from anchor
* `MiniCalendar` + `UpNext` — `mgrid` 42 days `md today/sel/in` + dots per `eventsByDate`, tomorrow via `addDays(..., timeZone)` + `minutesOfDay(..., timeZone)`
* `EventDialog` — Calendar picks, Date/Start/End/End-date/Timezone, All-day, Location, Notes, `isSaving` keeps dialog open until success
* Mobile — `side` drawer + `backdrop`, `tabs` 4-col, `fab`, responsive `@media 760px`

**Search (events + days):**
* Header search bar (`src/features/calendar/components/GlobalSearch.tsx`) — typing still filters the on-screen range (existing `q` behavior) and now also opens a dropdown with two sections:
  * **Days** — client-side parsing (`src/features/calendar/lib/search-date-parse.ts`) of "today"/"tomorrow"/"yesterday", `yyyy-MM-dd`, `MM/dd[/yyyy]`, weekday names ("monday", "next friday"), and "Month Day[, Year]" — click (or Enter) jumps straight to that day in Day view
  * **Events** — backed by `GET /api/events/search` (`event-repository.searchGlobal` / `event-service.searchEventsGlobal`), which is *not* bounded by the visible range, so a match next month or last year still shows up, sorted by closeness to now; selecting one jumps to its day and opens it
  * Keyboard: `↓/↑` to move, `Enter` to select, `Esc` to close; `/` still focuses the box

**Print:**
* `PrintIcon` button in the header (and a "Print…" row in the mobile sidebar) opens `src/features/print/components/PrintDialog.tsx`
* Choose scope — **Day / Week / Month / Agenda (30 days) / Custom range** — a date (or start+end for a custom range), which calendars to include, and whether to include location/notes
* Fetches events for that exact range via the existing `/api/events` endpoint, then `src/features/print/components/PrintPreview.tsx` renders a print-only layout (day list / week columns / month grid) portaled to `<body>` and triggers `window.print()`; print-only styling lives in the `@media print` block of `globals.css`

**Realtime:**
* `src/features/calendar/hooks/useRealtimeEvents.ts` subscribes to Supabase Postgres Changes on `public.events`, scoped to the visible calendars (`calendar_id=in.(...)`), and invalidates the `useCalendarEvents` cache on any insert/update/delete — so a change made in one tab/device shows up live in another without a manual refresh
* Requires `supabase/migrations/0002_enable_realtime.sql` to be applied (adds `events` to the `supabase_realtime` publication); RLS from `0001_enable_rls.sql` still governs which rows a given client is allowed to receive

**Security:**
* `supabase/migrations/0001_enable_rls.sql` — RLS enabled on 8 tables + policies for `user_profiles`, `workspaces`, `memberships`, `calendars`, `events`, `attendees`, `reminders`, `audit_logs`, `recurrence_rules` (viewer read-only, member write, `owner|admin` manage calendars); `REVOKE anon`, partial unique `calendars_one_default_per_workspace`
* `src/lib/dates/date-utils.ts` — civil `addDays(date, n, timeZone)`, `mondayOf`, `addMonths`, `toInstant` (no dead DST round-trip), `titleForView` agenda `Next 30 days`, half-open `[start,end)` in `event-repository.ts`

**Running:**
```bash
npm install
cp .env.example .env  # fill NEXT_PUBLIC_SUPABASE_URL (+PUBLISHABLE_KEY), SUPABASE_SECRET_KEY, DATABASE_URL (6543 pgbouncer), DIRECT_URL (5432)
# configure Supabase and Prisma connection settings
npx prisma migrate dev --name init  # or npx prisma db push
npm run prisma:seed   # 19 prototype events for current monday
npm run dev
```

## Next (intentionally deferred per §31)

Recurrence `RRULE` expansion + exceptions, Reminder delivery (background queue), Attendee invite flow, external sync (`IntegrationAccount`), billing (`Plan/Subscription`).

See `tempo-construction-notebook-v3.md` for the hardening → RLS → recurrence → collaboration sequence.
