-- Bring the database in line with prisma/schema.prisma, which had been
-- edited (Event.labels, Event.priority, the Notification model,
-- @db.Timestamptz(3) on every DateTime) without a matching migration ever
-- being generated. This caused every /api/events read to fail with:
--   "The column `events.labels` does not exist in the current database"
-- because the generated Prisma Client selects columns the table didn't have.
--
-- Applied directly against production via the Supabase connector on
-- 2026-09-25 (see _prisma_migrations for the matching ledger entry) because
-- production was actively down; this file exists so `prisma migrate deploy`
-- and any fresh environment reach the same schema without re-deriving it.

ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "labels" text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "priority" integer NOT NULL DEFAULT 2;

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user_profiles"("id") ON DELETE CASCADE,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "event_id" text REFERENCES "events"("id") ON DELETE CASCADE,
  "is_read" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_idx" ON "notifications" ("user_id", "is_read");
CREATE INDEX IF NOT EXISTS "notifications_workspace_id_idx" ON "notifications" ("workspace_id");
CREATE INDEX IF NOT EXISTS "notifications_created_at_idx" ON "notifications" ("created_at");
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;

-- timestamp -> timestamptz(3), matching @db.Timestamptz(3) already in schema.prisma.
-- Existing naive values were always written as UTC instants by the app, so
-- reinterpreting (not shifting) them as UTC is the correct, lossless conversion.
ALTER TABLE "user_profiles"
  ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "workspaces"
  ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "memberships"
  ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "calendars"
  ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "events"
  ALTER COLUMN "start_at" TYPE timestamptz(3) USING "start_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "end_at" TYPE timestamptz(3) USING "end_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" TYPE timestamptz(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "recurrence_rules"
  ALTER COLUMN "dtstart" TYPE timestamptz(3) USING "dtstart" AT TIME ZONE 'UTC',
  ALTER COLUMN "until" TYPE timestamptz(3) USING "until" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "attendees"
  ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "reminders"
  ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "audit_logs"
  ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC';
