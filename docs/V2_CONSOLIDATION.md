# One Tempo codebase and shared database

Canonical repository: tempo (existing origin Gabrieldevgit/Agenda). Web source and API remain in src; Prisma schema and migrations remain in prisma; the native Android/iOS companion is in mobile; shared transport types are in shared/contracts.ts. This preserves the old Tempo Git history.

The former Agenda-Tempo-V2 and tempo-mobile package scripts delegate to this repository. Their source snapshots are preserved for reference; they are not independent application entrypoints. The workspace root npm run dev starts the canonical web app on port 3100.

All application API routes require a verified Supabase user, from web cookies or a native Bearer token. GET /api/session resolves workspace membership and calendars; no client hard-codes a demo workspace. Workspace roles remain the authorization boundary.

No sample/demo events or calendars are generated. New accounts receive one empty My calendar. Existing user records were not removed. Automated tests use temporary fixtures and clean up only their own records.

## Assistant

Settings → AI Assistant and the chat expose six persisted permissions, initially disabled. Reading sends accessible schedule data to the selected provider. Enabled mutation tools create a proposal rather than writing immediately. Apply changes rechecks identity, permissions, workspace scope and role. Plans expire after ten minutes and are claimed once. Partial failures are displayed; failed plans cannot be blindly retried. Calendar deletion is recoverable.

## Deployment

Apply migrations with prisma migrate deploy. Native builds need the deployed web API URL and only public Supabase settings. Never copy the server .env into the app. Server Groq keys stay on the server. Google account calendar synchronization, outgoing invitation email and native push delivery remain separate integrations.
