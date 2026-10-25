# V2 consolidation update — October 25, 2026

Calendar management is visible beside My calendars, including recoverable deletion and restore. Persisted AI permissions and reviewed actions use the same workspace authorization as direct edits. The native companion and shared contracts now live in this repository. Database integration tests and a live Groq tool-call/approval test passed. Native iOS compilation still requires macOS. See [consolidation details](docs/V2_CONSOLIDATION.md).

# Implementation status — October 24, 2026

The primary application is `tempo/`. This pass fixes the demonstrated AI/build problems and delivers a substantial part of the calendar backlog. Full Google Calendar parity is still incomplete. The original feature inventory is in `GOOGLE_CALENDAR_AUDIT.md` and remains a point-in-time audit, not a list of completed features.

## Delivered and exercised

- Production build, TypeScript and ESLint now work. Fixed profile types/icons and the AI route importing browser hooks into server code.
- Google-inspired light/dark theme, accessible event-dialog focus handling, functional date-picker month navigation and consistent calendar colors.
- Corrected civil-date/week/month calculations, all-day creation and reversed-date validation, DST-gap feedback, current-time marker refresh, drag versus page-swipe conflicts, stale search responses and empty calendar search filtering.
- Labels and priorities now persist. Partial PATCH validation preserves omitted fields, including with Zod 4; server validation normalizes nullable database fields before checking a complete event.
- Recurrence: daily/weekly/monthly/yearly, intervals, weekday and ordinal rules, count/until, exclusions, overlap-aware range expansion, single-occurrence edits, series edits and splitting/deleting following occurrences. Overrides and exclusions are committed together. Soft deletion retains recurrence for restoration.
- Event color overrides, private/default/public-within-shared-calendar visibility, free/busy, conference URLs, reminder offsets and event-type metadata for focus/out-of-office/working-location. Private details are redacted from viewers; workspace writers retain editing access.
- Calendar creation, renaming, colors, archiving/unarchiving. Existing workspace owner/admin permissions remain enforced.
- Advanced search by text, location, date range and calendar. Range requests are limited to 367 days.
- ICS and Google-style CSV preview/import; ICS export preserves series/exclusions, handles UTF-8 folding and all-day date boundaries. Imported RECURRENCE-ID overrides exclude the original slot. Unsupported alarm/guest-import behavior is disclosed. Import is per-event with partial-failure reporting, not an all-or-nothing batch.
- Trash listing and restoration.
- Private task lists, notes, deadlines, scheduled blocks, edit/delete and completion. Scheduled tasks appear in calendar views and can be rescheduled; completed tasks disappear. Tasks are isolated by user and workspace.
- Availability suggestions across accessible calendars, editable local work window and seven-day time summaries. This is calendar availability, not a multi-participant scheduling engine. Event-duration totals count overlaps separately.
- Guest lists/optional flags, shareable invitation links, expiring hashed tokens, token rotation/revocation, external RSVP pages and response notifications to the organizer. Links are shared manually; outgoing email is not enabled.
- Persisted in-app reminder worker at `GET /api/jobs/reminders`. A configured scheduler must call it with `Authorization: Bearer <CRON_SECRET>`. The secret must have at least 32 characters. Notifications use deterministic IDs to deduplicate browser and worker retries. The worker catches up ten minutes and caps each run at 5,000 reminder rows; larger installations need a persistent cursor/queue extension.
- Demo stores and authentication bypasses have been removed. New users receive one empty calendar; all app data comes from the database.
- Server event refresh fallback every 30 seconds for deployments where direct Supabase realtime access is unavailable.

## AI repair verified against the user's reported failure

The old catalogs advertised retired Groq models, and provider failures were presented as mock answers. The browser key field was not actually sent to the proxy; the UI also incorrectly required it even when the server key was configured.

- Model discovery now queries the selected provider account. Startup Groq defaults use GPT OSS 20B; known retired saved selections migrate.
- Model selection is checked against the live list, including image capability. If a model disappears between discovery and completion, the service refreshes and tries another available model once.
- Full personal keys work without double prefixes; an empty browser key uses the server credential. Keys are separated when switching providers, are never returned by model discovery, and are never logged.
- Real provider errors retain error status. There is no fabricated mock fallback. Conversation history and timeouts are handled explicitly.
- The assistant reads accessible schedule data only when granted permission, and proposes reviewed event/calendar actions. Workspace roles and current permissions are checked again on approval.
- Removed the one-year cache override from development JavaScript. Previously cached localhost scripts can still require a hard browser refresh; the verified fresh preview is `http://127.0.0.1:3100/`.
- Live account model listing succeeded. A service request using the retired Llama ID returned `TEMPO_AI_OK` through `openai/gpt-oss-20b`. A browser request returned `Tempo AI is working.` with the server credential. Evidence: `docs/ai-verified.png`.

Provider references: [Groq models](https://console.groq.com/docs/models), [Groq deprecations](https://console.groq.com/docs/deprecations).

## Database and deployment

Four additive/idempotent migrations were applied: event options, tasks, invitation/delivery storage, and baseline repair. The repair supplies labels, priorities and notifications that were already present remotely but absent from the checked-in migration chain. Existing applied migration history was not rewritten. No user events were reset or deleted.

New tasks and delivery tables have RLS enabled and no direct grants to anonymous/authenticated Data API roles. Prisma services enforce user/workspace authorization. Temporary database QA users/workspaces/events are removed by the integration script.

Use Node 22.12+ (verified on Node 24). Dependency audit currently reports zero known vulnerabilities; this is an audit snapshot, not a security guarantee.

To activate background reminders, set `CRON_SECRET` and configure a server scheduler to call `/api/jobs/reminders` once per minute. No scheduler or recurring Codex automation was provisioned. No invitation email was sent during this work.

## Remaining work from the original request

- Google OAuth calendar consent and two-way synchronization, token encryption/refresh, webhooks/channel renewal and conflict handling.
- Per-calendar ACLs, sharing invitations, public calendars/embeds/feeds, subscriptions, regional holidays, birthdays, alternate calendars, rooms/resources and ownership transfer.
- Email delivery provider provisioning and the outgoing delivery worker. Invitation payload storage exists; live email sending does not. The Vercel CLI attempted to start a device login because this machine has no CLI credentials. No external provider account/resource was created.
- Web push subscriptions, service worker and closed-browser OS notifications. The current worker creates persistent in-app notifications; browser notifications require an open page.
- Appointment schedules/booking pages, atomic reservations, co-host rules, booking forms/verification, payment processing and cancellation policies.
- Repeating tasks, task-provider sync, fine-grained guest permissions, meeting-time proposals and full organizer/invitation update/cancellation mail semantics.
- Automatic focus/out-of-office decline rules, recurring work locations, split/week-specific working hours, second timezones/world clocks and locale/alternate date display. Current work-status types are stored metadata.
- Full offline app loading, cached reads/outbox/conflict resolution, account switching and server-synced preferences.
- AI now supports permission-controlled schedule reading and reviewed event/calendar mutation tools. See docs/V2_CONSOLIDATION.md.
- Drive/Gmail/Meet/Contacts integrations, add-ons and native mobile/watch/widget parity.
- Comprehensive browser coverage of every pre-existing feature and accessibility flow; no claim that every possible application issue is fixed.

Email provisioning follows the installed [Marketplace skill](C:/Users/gabet/.codex/plugins/cache/openai-curated-remote/vercel/0.54.1/skills/marketplace/SKILL.md), which requires: “provision first, then build.” Its account-login step must be completed before a provider-specific mail sender is built.

## Verification

- `npm run build`: passes, including all new routes.
- `npm run typecheck`: passes.
- `npm run lint`: passes without warnings.
- `npm test`: 36 tests pass, covering layout, recurrence, DST, PATCH preservation, validation, ICS/CSV, planning and AI provider behavior.
- `npm run test:integration`: passes against temporary database fixtures: event metadata persistence, viewer/outsider authorization, private redaction, recurring override/split behavior, trash/restore, task isolation/completion, RSVP token revocation, invitation-job persistence and reminder deduplication. Fixtures are cleaned up.
- Browser: real Groq answer, recurring event creation, scheduled task rendering and completion were observed. Native date/time inputs were committed using actual key events during verification.
- `npm audit`: zero vulnerabilities after dependency updates.

No PR, commit, production app deployment, paid account, external email or payment transaction was created.

Production HTTP verification: unauthenticated AI model/chat/task requests return 401; the unconfigured scheduler returns 503; an invalid invitation returns 404. The local development preview was restarted on port 3100 after the production check.

## Authenticated browser verification

The real signed-in preview loads database calendars and events. Calendar creation and explicit rename were exercised through the sidebar manager with a dedicated temporary calendar. Unauthenticated session, calendar and AI permission API requests returned 401. Native TypeScript, ESLint and Metro bundling pass. The Android C++ staging directory is shortened for Windows toolchain path limits.

Android debug APK compiled successfully for arm64-v8a, armeabi-v7a, x86 and x86_64. Output: mobile/android/app/build/outputs/apk/debug/app-debug.apk. This is a development build requiring Metro and the configured local backend, not a signed store release.

Calendar deletion and restoration were also verified through the signed-in browser, followed by removal of the isolated temporary calendar. The assistant returned “Tempo is connected.” through the authenticated chat route with all calendar permissions still disabled. No real schedule data was sent during that check.
