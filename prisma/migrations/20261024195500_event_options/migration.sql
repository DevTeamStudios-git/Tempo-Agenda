-- AlterTable
ALTER TABLE "events" ADD COLUMN     "availability" TEXT NOT NULL DEFAULT 'busy',
ADD COLUMN     "color" TEXT,
ADD COLUMN     "conference_url" TEXT,
ADD COLUMN     "event_type" TEXT NOT NULL DEFAULT 'event',
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'default';
