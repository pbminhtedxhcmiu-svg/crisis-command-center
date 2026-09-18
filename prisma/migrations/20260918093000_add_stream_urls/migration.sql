-- Thêm stream_urls cho LiveEvent: JSON map platform→URL linkstream
-- An toàn với dữ liệu cũ: cột mới, default "{}"
ALTER TABLE "live_events" ADD COLUMN "stream_urls" TEXT NOT NULL DEFAULT '{}';
