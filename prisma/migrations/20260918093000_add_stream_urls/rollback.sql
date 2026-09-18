-- Rollback: gỡ stream_urls
ALTER TABLE "live_events" DROP COLUMN "stream_urls";
