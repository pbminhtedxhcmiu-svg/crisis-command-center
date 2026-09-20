-- Kịch bản demo cố định (scripted) thay cho demo ngẫu nhiên
-- o_sau_rieng | crisis_live | classic_mix — default an toàn với dữ liệu cũ
ALTER TABLE "live_events" ADD COLUMN "sim_scenario" TEXT NOT NULL DEFAULT 'o_sau_rieng';
