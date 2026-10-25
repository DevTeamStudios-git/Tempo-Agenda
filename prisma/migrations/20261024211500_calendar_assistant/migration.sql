-- AlterTable
ALTER TABLE "calendars" ADD COLUMN     "deleted_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "assistant_policies" (
    "user_id" TEXT NOT NULL,
    "can_read" BOOLEAN NOT NULL DEFAULT false,
    "can_create_events" BOOLEAN NOT NULL DEFAULT false,
    "can_edit_events" BOOLEAN NOT NULL DEFAULT false,
    "can_delete_events" BOOLEAN NOT NULL DEFAULT false,
    "can_create_calendars" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_calendars" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assistant_policies_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "assistant_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "actions" JSONB NOT NULL,
    "results" JSONB,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assistant_plans_user_id_created_at_idx" ON "assistant_plans"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "assistant_policies" ADD CONSTRAINT "assistant_policies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_plans" ADD CONSTRAINT "assistant_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_plans" ADD CONSTRAINT "assistant_plans_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE assistant_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON assistant_policies, assistant_plans FROM anon, authenticated;
