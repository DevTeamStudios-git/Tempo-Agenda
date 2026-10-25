# Tempo: codebase audit and Google Calendar implementation backlog

**Current implementation:** see [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md). The tables below describe the initial audit, before the subsequent fixes/features.

Reviewed: October 24, 2026. This is a feature inventory and implementation plan, not a claim that the missing features have been built. Google changes its product continuously; this is a broad inventory of documented feature families, including Workspace and subscription-dependent features, rather than a guarantee of every experiment or platform-specific variation.

## Scope and architecture

- `tempo/`: primary Next.js 15 / React 18 / TypeScript web app, the only Git repository in this workspace. This is the target of the theme implementation.
- `Agenda-Tempo-V2/`: separate web copy with additional recurrence, offline and ICS files. Do not assume those features exist in `tempo` or copy them without checking compatibility. Consolidating the two apps should be a deliberate future decision.
- `tempo-mobile/`: React Native companion; its README identifies `../tempo` as its web/backend counterpart. Main feature is a responsive Book agenda. The web theme does not modify native styles.
- Web flow: app route -> CalendarShell -> query hooks -> API routes -> services with authorization -> repositories -> Prisma/Postgres. Authentication and realtime use Supabase. Workspace memberships provide roles, but do not provide Google-style per-calendar sharing by themselves.
- CalendarShell coordinates seven view modes, navigation, search, selection, dialogs, clipboard/context menu operations, reminders, printing, AI and settings. It is a large orchestration component and a future decomposition candidate.
- Calendar types, EventDialog and event validation expose basic event fields, labels and priority. Prisma additionally defines RecurrenceRule, Attendee and Reminder. A database model alone is not a delivered feature.

## Existing capabilities verified in source

| Area | Evidence in tempo/src | Assessment |
| --- | --- | --- |
| Views | features/calendar/components/{TimeGrid,MonthView,AgendaView,YearView,BookView}.tsx; features/notebook | Day/week/month/agenda/year plus Tempo book/notebook views |
| Event editing | features/events/components/EventDialog.tsx; features/events/validation/event-schema.ts | Title, notes, location, dates/times, timezone, all-day, calendar, labels, priority |
| Interaction | features/calendar/hooks/useEventDrag.ts; CalendarShell.tsx; ContextMenu.tsx | Drag/resize and clipboard/context actions have implementations; edge cases need runtime checks |
| Discovery | GlobalSearch.tsx; CommandPalette.tsx; api/events/search | Event/date search, keyboard navigation and command palette |
| Calendars | useCalendars.ts; api/calendars; calendar-service.ts | Workspace calendar CRUD/filtering and authorization; sharing/subscription UI absent |
| Printing | features/print | Range/calendar selection and dedicated print preview |
| Notifications | features/notifications; server/services/notification-service.ts | Notification center and browser-side reminder checks; not evidence of a durable delivery worker |
| Preferences | lib/settings.ts; lib/theme.ts; SettingsDialog.tsx | Theme, timezone, week start, time format and other locally stored preferences; individual effects need verification |
| Live updates | useRealtimeEvents.ts | Postgres change subscription; deployment configuration and policies still matter |
| Tempo extras | features/ai; features/pomodoro; features/clock; features/notebook | AI chat, focus timer, live clock and day notes; these do not substitute for Calendar product features |

## Google Calendar parity backlog

Status below is relative to the primary `tempo` app. P1 = core parity; P2 = collaboration/productivity; P3 = advanced/integration. Existing foundations still need acceptance checks. Sources are linked by feature group to distinguish Google capabilities from proposed Tempo implementation choices.

### Events and recurrence

Source: [Calendar event resource](https://developers.google.com/workspace/calendar/api/v3/reference/events), [calendars and events](https://developers.google.com/workspace/calendar/api/concepts/events-calendars).

| Feature to implement or complete | Current state | Priority / completion criteria |
| --- | --- | --- |
| Core event CRUD, all-day, multi-day, timezone | Implemented foundation | P1: verify DST, midnight, inclusive display/exclusive end, validation and undo |
| Custom recurring events | Schema only | P1: daily/weekly/monthly/yearly, intervals, selected weekdays, ordinal weekdays, count/until, timezone-aware expansion |
| Recurrence exceptions | Absent | P1: edit/delete this occurrence, following occurrences or entire series; preserve stable instance IDs |
| Event color override | Calendar colors only in domain type | P1: store event color separately from calendar color |
| Availability and privacy | Absent in event contract | P1: free/busy and default/public/private; redact private details server-side |
| Rich descriptions and links | Plain description foundation | P2: safe formatting and clickable links |
| Guests, optional guests and organizer | Attendee schema only | P1: email invitations, external guests, organizer identity and optional participants |
| RSVP and invitation management | Absent end-to-end | P1: accept/tentative/decline, response comments, updates/cancellations and response tracking |
| Guest permissions | Absent | P2: modify event, invite others, see guest list; enforce server-side |
| Proposed meeting times | Absent | P2: suggest alternatives and organizer approval |
| Attachments / conference details | Absent structured fields | P2: file permissions, conference links, unique Meet creation through authorized integration |
| Copy/move/transfer ownership | Clipboard and calendar-move foundation | P2: verify supported moves, explicit ownership transfer and invitation semantics |
| Trash and restore | Soft delete and restore endpoints | P1: visible trash, restore and retention/purge policy |

### Calendar organization, display and settings

Source: [Google Calendar help topics](https://support.google.com/calendar/?hl=en).

| Feature to implement or complete | Current state | Priority / completion criteria |
| --- | --- | --- |
| Custom view lengths and mini-calendar selection | Fixed views exist | P2: configurable multi-day/multi-week range and remembered view |
| Advanced event search | Text/date search foundation | P1: date bounds, calendar, organizer, guests and location filters |
| Per-calendar sharing | Workspace membership only | P1: free/busy, details, edit, manage-sharing roles; invitation/revocation flow |
| Public calendars and embedding | Absent | P2: opt-in public view, read-only embeds and revocable published feeds |
| Subscribe to calendars / URL feeds | Absent | P2: subscribe/unsubscribe, refresh schedule, errors and deduplication |
| Holidays, birthdays and alternate calendars | Absent | P2: regional holiday subscriptions, birthday source and alternate-date display |
| Resource and family/team calendars | Generic workspace calendars only | P3: resource metadata, booking permissions and conflict rejection |
| Calendar ownership transfer | Absent | P2: authorized transfer and explicit recipient acceptance |
| Notification defaults / overrides | Reminder schema + local notifier | P1: per-calendar defaults and multiple per-event reminder offsets |
| Durable email / push reminders | No worker verified | P1: background scheduling, retry/dedupe, delivery preferences and closed-browser delivery |
| Locale / timezone tools | Single-zone formatting preferences | P2: language/date format, secondary timezone and world clock |
| Display preferences | Existing local settings | P1: audit density, weekends, week start and past-event effects; P2: week numbers and declined-event visibility |
| Accessible interaction | Focus/reduced-motion basics | P1: dialog focus containment/return, semantic grids, labels, contrast and keyboard drag alternatives |
| Offline support | Not present in primary app source inventory | P2: cached reads first; explicit outbox/conflict handling for writes |
| Account switching and preference sync | Auth/profile foundation | P2: account switcher and server-persisted preferences |

### Tasks, work status and scheduling

Sources: [Tasks](https://support.google.com/calendar/answer/9901136?hl=en), [focus time](https://support.google.com/calendar/answer/11190973?hl=en-GB), [appointment schedules](https://support.google.com/calendar/answer/10729749?hl=en&ref_topic=10729441).

| Feature to implement | Current state | Priority / completion criteria |
| --- | --- | --- |
| Calendar tasks | Absent | P2: task lists, deadlines, scheduled duration, completion and repeating tasks; tasks need their own domain model |
| Focus time / out of office | Pomodoro is a separate timer | P2: event types, decline rules and availability; external chat status requires its own integration |
| Working hours / working location | Absent | P2: split work periods, recurring/home/office/custom location and date overrides |
| Find a time / suggested availability | Absent | P2: authorized free/busy lookup, overlaps, timezones and working hours |
| Appointment booking pages | Absent | P2: public schedule URL, duration, weekly slots and date overrides |
| Booking constraints | Absent | P2: lead time, booking horizon, buffers, daily limits and multi-calendar conflict checks |
| Booking forms and hosts | Absent | P2: custom questions, verified email, co-host availability and conferencing |
| Booking lifecycle | Absent | P2: confirmations, reminders, rescheduling/cancellation; atomic reservation prevents double-booking |
| Paid appointments | Absent | P3: payment-provider integration, cancellation policy and reconciled booking/payment state |
| Time insights | Absent | P3: meeting/focus breakdown, goals and privacy-aware aggregates |

Some work-status, task-protection and booking options depend on Google's account/subscription tier. Tempo needs its own feature policy rather than assuming that owning a Google account unlocks every integration.

### Google and external integrations

Sources: [OAuth scopes](https://developers.google.com/workspace/calendar/api/auth), [incremental synchronization](https://developers.google.com/workspace/calendar/api/guides/sync), [Google Calendar concepts](https://developers.google.com/workspace/calendar/api/concepts), [AI scheduling](https://support.google.com/calendar/answer/16690875?hl=en).

| Feature to implement | Current state | Priority / completion criteria |
| --- | --- | --- |
| Connect Google Calendar | Google sign-in only | P1: separate consent/scopes, encrypted refresh credentials, reconnect/disconnect and account identity |
| Two-way event/calendar sync | Absent | P1: external IDs, sync tokens, deletion tombstones, pagination, retries, conflict policy and full resync on expired token |
| Change notifications | Supabase realtime is internal | P2: provider webhook channel renewal and incremental sync; webhook is a trigger, not event content |
| Calendar list / sharing sync | Absent | P2: external calendars, ACL mapping and permission changes |
| ICS/CSV import and ICS export | README claim exceeds current source | P1: implement parsers/export, recurrence/timezone round trips and import preview; ICS UI/library found in sibling copy only |
| Other calendar clients | Absent | P3: scoped ICS feeds first; assess CalDAV separately rather than promising it through Google's REST API |
| Meet / Drive / Gmail / Contacts | Absent as integrations | P2/P3: independent permissions, event conferences, authorized attachment access, birthday sources and explicit smart-event consent |
| Tasks provider sync | Absent | P3: separate Tasks API integration and task/event distinction |
| Workspace side panel / add-ons | Custom AI exists | P3: contextual productivity integrations; do not copy Google proprietary add-on runtime |
| AI scheduling | General Tempo chat foundation | P3: tool-backed availability proposals, permission checks and user review of changes |
| Mobile/watch/widget parity | Native Book companion only | P3: native event CRUD, notifications, account sync and platform-specific surfaces |
| Invitation abuse controls | Absent explicit product flow | P2: trusted-sender policy, blocking/reporting and limits on invite/booking endpoints |

## Proposed implementation order

1. Next prompt: resolve existing compile/runtime issues, consolidate source-of-truth decisions and validate auth/CRUD/date handling. Preserve existing uncommitted work.
2. Complete event contract: recurrence/instances, privacy, availability, colors, reminders, guests and validation. Add migrations and matching authorization before UI switches.
3. Deliver collaboration: invitations/RSVP, per-calendar ACLs, free/busy, notification worker and trash UI.
4. Add data portability and Google integration: import/export first, then account linking and resilient two-way sync.
5. Deliver tasks/work status/working hours, booking pages and availability checks.
6. Add insights, productivity integrations, advanced accessibility/offline support and native parity.

Suggested new models: RecurrenceException, CalendarPermission, CalendarSubscription, IntegrationAccount, ExternalEventMapping, SyncCursor, DeliveryJob, TaskList, Task, AvailabilityRule, BookingSchedule and Booking. These are proposed designs, not existing schema. All routes should continue to enforce authorization in services; external credentials must stay server-side.

## Theme delivered in this pass

`src/app/globals.css`: Google-inspired blue/neutral palette, system sans-serif typography without a remote font dependency, refined toolbar/search/view controls, softer create button, enclosed calendar canvas, circular current-date emphasis, quieter event blocks, dialogs and consistent notebook surroundings. Light/dark/system theme selection remains supported. New layout overrides are screen-only to preserve print presentation. Mobile drawer and six navigation tabs are retained.

Resolved the stylesheet's existing merge-conflict block as a necessary prerequisite for compiling the theme. No unrelated feature or backend fixes were attempted.

## Known issues and validation handoff

- Baseline `npm run typecheck` fails in existing, untracked ProfileAvatar.tsx (possibly undefined string indexing) and ProfileMenu.tsx (missing icon exports / conflicting HelpIcon declaration). These predate the theme changes.
- Baseline stylesheet contained merge markers at the mobile main/tabs rules; resolved in this pass using the six-tab variant.
- README documents ICS/offline/recurrence work beyond what primary app files provide. Treat source and reachable routes as evidence; reconcile docs during the next pass.
- Existing modifications to package.json, AI chat, settings and untracked auth components were preserved.
- Feature presence is a static source assessment, not an end-to-end guarantee. External auth/database, email, sync and mobile behavior require configured runtime verification.

Validation: all 3 existing Vitest tests pass; PostCSS parses the updated stylesheet successfully; git diff --check passes. Visual browser verification has not been performed. Production build result is recorded below when available.

Production build fails on the existing server/client boundary: src/app/api/ai/chat/route.ts imports src/lib/settings.ts, which imports useEffect/useState. Separate shared provider constants/types from browser hooks during the next issue-fix pass. No successful production build or browser visual verification is claimed.
