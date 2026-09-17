-- ROLLBACK cho migration init (SQLite không hỗ trợ prisma migrate down)
-- Cách dùng: dừng app, xoá file DB, chạy lại migrate từ đầu:
--   rm prisma/dev.db && npx prisma migrate deploy
-- Hoặc đảo chiều thủ công từng bảng (thứ tự con → cha):
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS policy_rules;
DROP TABLE IF EXISTS approvals;
DROP TABLE IF EXISTS response_drafts;
DROP TABLE IF EXISTS response_templates;
DROP TABLE IF EXISTS incident_assignments;
DROP TABLE IF EXISTS incident_evidence;
DROP TABLE IF EXISTS incident_timeline;
DROP TABLE IF EXISTS incidents;
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS signals;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS stream_segments;
DROP TABLE IF EXISTS simulator_state;
DROP TABLE IF EXISTS live_events;
DROP TABLE IF EXISTS playbooks;
DROP TABLE IF EXISTS platform_connections;
DROP TABLE IF EXISTS campaigns;
DROP TABLE IF EXISTS brands;
DROP TABLE IF EXISTS memberships;
DROP TABLE IF EXISTS workspaces;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
