-- AlterTable
ALTER TABLE "attendees" ADD COLUMN     "invite_expires_at" TIMESTAMPTZ(3),
ADD COLUMN     "invite_token_hash" TEXT;

-- CreateTable
CREATE TABLE "delivery_jobs" (
    "id" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "payload" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_jobs_dedupe_key_key" ON "delivery_jobs"("dedupe_key");

-- CreateIndex
CREATE INDEX "delivery_jobs_delivered_at_next_attempt_at_idx" ON "delivery_jobs"("delivered_at", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "attendees_invite_token_hash_key" ON "attendees"("invite_token_hash");

ALTER TABLE delivery_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE delivery_jobs FROM anon, authenticated;
