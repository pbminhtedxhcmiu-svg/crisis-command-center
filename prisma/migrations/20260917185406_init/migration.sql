-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "memberships_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brands_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaigns_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "campaigns_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "live_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "data_mode" TEXT NOT NULL DEFAULT 'DEMO',
    "scheduled_at" DATETIME,
    "started_at" DATETIME,
    "ended_at" DATETIME,
    "platforms" TEXT NOT NULL,
    "products" TEXT,
    "host_user_id" TEXT,
    "producer_user_id" TEXT,
    "playbook_id" TEXT,
    "risk_keywords" TEXT NOT NULL DEFAULT '[]',
    "oncall_user_ids" TEXT NOT NULL DEFAULT '[]',
    "escalation_user_id" TEXT,
    "sim_state" TEXT NOT NULL DEFAULT 'STOPPED',
    "sim_tick" INTEGER NOT NULL DEFAULT 0,
    "sim_seed" INTEGER NOT NULL DEFAULT 42,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "live_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "live_events_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "live_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "live_events_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "playbooks" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "platform_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "external_ref" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_connections_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stream_segments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    CONSTRAINT "stream_segments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "live_events" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "author_masked" BOOLEAN NOT NULL DEFAULT true,
    "raw_text" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'vi',
    "engagement" TEXT NOT NULL DEFAULT '{}',
    "topic" TEXT NOT NULL DEFAULT 'other',
    "risk_type" TEXT NOT NULL DEFAULT 'none',
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "processing_status" TEXT NOT NULL DEFAULT 'CLASSIFIED',
    "signal_id" TEXT,
    "dedupe_key" TEXT,
    "sim_tick" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "live_events" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "messages_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signals" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "signals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "risk_type" TEXT NOT NULL,
    "message_count" INTEGER NOT NULL DEFAULT 1,
    "velocity" INTEGER NOT NULL DEFAULT 0,
    "first_message_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "signals_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "live_events" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_id" TEXT NOT NULL,
    "signal_id" TEXT,
    "title" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'P3',
    "severity" TEXT NOT NULL DEFAULT 'P3',
    "reason" TEXT NOT NULL,
    "evidence_count" INTEGER NOT NULL DEFAULT 1,
    "velocity" INTEGER NOT NULL DEFAULT 0,
    "policy_match" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignee_id" TEXT,
    "acknowledged_at" DATETIME,
    "snoozed_until" DATETIME,
    "incident_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "alerts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "live_events" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "alerts_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signals" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "alerts_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "severity" TEXT NOT NULL DEFAULT 'P2',
    "owner_id" TEXT,
    "sla_ack_due_at" DATETIME,
    "sla_ack_at" DATETIME,
    "sla_action_due_at" DATETIME,
    "sla_action_at" DATETIME,
    "resolved_at" DATETIME,
    "resolution" TEXT,
    "reopened_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "incidents_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "incidents_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "live_events" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "incidents_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "incident_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incident_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'support',
    "assigned_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incident_assignments_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "incident_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "incident_evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incident_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ref_id" TEXT,
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incident_evidence_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "incident_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incident_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incident_notes_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "incident_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "incident_timeline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incident_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incident_timeline_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "playbooks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "playbooks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "response_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "playbook_id" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'comment_reply',
    "situation_topic" TEXT NOT NULL DEFAULT 'other',
    "channel" TEXT NOT NULL DEFAULT 'comment',
    "tone" TEXT NOT NULL DEFAULT 'professional',
    "body" TEXT NOT NULL,
    "variables" TEXT NOT NULL DEFAULT '[]',
    "banned_claims" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "approver_role" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "response_templates_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "response_templates_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "playbooks" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "response_drafts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "incident_id" TEXT,
    "template_id" TEXT,
    "author_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'comment_reply',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "request_key" TEXT,
    "reject_reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "response_drafts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "response_drafts_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "response_drafts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "response_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "response_drafts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "draft_id" TEXT NOT NULL,
    "incident_id" TEXT,
    "requester_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decided_by_id" TEXT,
    "decision_note" TEXT,
    "decided_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approvals_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "approvals_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "response_drafts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "approvals_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "policy_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "riskType" TEXT NOT NULL,
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "min_velocity" INTEGER NOT NULL DEFAULT 3,
    "priority" TEXT NOT NULL DEFAULT 'P2',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "policy_rules_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "type" TEXT NOT NULL,
    "ref_id" TEXT,
    "read_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "detail" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reports_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reports_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "live_events" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_workspace_id_user_id_key" ON "memberships"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "brands_workspace_id_idx" ON "brands"("workspace_id");

-- CreateIndex
CREATE INDEX "campaigns_workspace_id_idx" ON "campaigns"("workspace_id");

-- CreateIndex
CREATE INDEX "campaigns_brand_id_idx" ON "campaigns"("brand_id");

-- CreateIndex
CREATE INDEX "live_events_workspace_id_status_idx" ON "live_events"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "live_events_brand_id_idx" ON "live_events"("brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_connections_workspace_id_platform_key" ON "platform_connections"("workspace_id", "platform");

-- CreateIndex
CREATE INDEX "stream_segments_event_id_idx" ON "stream_segments"("event_id");

-- CreateIndex
CREATE INDEX "messages_event_id_created_at_idx" ON "messages"("event_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "messages_event_id_external_id_key" ON "messages"("event_id", "external_id");

-- CreateIndex
CREATE INDEX "signals_event_id_topic_idx" ON "signals"("event_id", "topic");

-- CreateIndex
CREATE INDEX "signals_event_id_last_message_at_idx" ON "signals"("event_id", "last_message_at");

-- CreateIndex
CREATE INDEX "alerts_event_id_status_idx" ON "alerts"("event_id", "status");

-- CreateIndex
CREATE INDEX "alerts_event_id_priority_idx" ON "alerts"("event_id", "priority");

-- CreateIndex
CREATE INDEX "incidents_workspace_id_status_idx" ON "incidents"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "incidents_event_id_idx" ON "incidents"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_workspace_id_code_key" ON "incidents"("workspace_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "incident_assignments_incident_id_user_id_role_key" ON "incident_assignments"("incident_id", "user_id", "role");

-- CreateIndex
CREATE INDEX "incident_evidence_incident_id_idx" ON "incident_evidence"("incident_id");

-- CreateIndex
CREATE INDEX "incident_notes_incident_id_idx" ON "incident_notes"("incident_id");

-- CreateIndex
CREATE INDEX "incident_timeline_incident_id_idx" ON "incident_timeline"("incident_id");

-- CreateIndex
CREATE INDEX "response_templates_workspace_id_situation_topic_idx" ON "response_templates"("workspace_id", "situation_topic");

-- CreateIndex
CREATE UNIQUE INDEX "response_drafts_request_key_key" ON "response_drafts"("request_key");

-- CreateIndex
CREATE INDEX "response_drafts_workspace_id_status_idx" ON "response_drafts"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "response_drafts_incident_id_idx" ON "response_drafts"("incident_id");

-- CreateIndex
CREATE INDEX "approvals_workspace_id_status_idx" ON "approvals"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "policy_rules_workspace_id_idx" ON "policy_rules"("workspace_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_created_at_idx" ON "audit_logs"("workspace_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reports_event_id_key" ON "reports"("event_id");
