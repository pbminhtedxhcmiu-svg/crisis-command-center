-- Playbook 'Rủi ro phát ngôn host/KOL': checklist trước live + từ khóa cảnh báo
-- An toàn với dữ liệu cũ: cột mới có default, bảng con mới
ALTER TABLE "playbooks" ADD COLUMN "checklist" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "playbooks" ADD COLUMN "risk_keywords" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "live_events" ADD COLUMN "checklist_state" TEXT NOT NULL DEFAULT '{}';

-- Checklist item tĩnh của playbook (đọc-ghim trước giờ live)
CREATE TABLE "playbook_checklist_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playbook_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "playbook_checklist_items_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "playbooks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "playbook_checklist_items_playbook_id_position_idx" ON "playbook_checklist_items"("playbook_id", "position");
