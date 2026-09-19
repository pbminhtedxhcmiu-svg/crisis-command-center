-- Bỏ cột JSON checklist trên playbooks — bảng con playbook_checklist_items là nguồn duy nhất
ALTER TABLE "playbooks" DROP COLUMN "checklist";
