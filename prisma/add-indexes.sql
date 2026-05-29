-- LookAhead Pro — performance indexes
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query > paste > Run).
-- Safe to re-run: every statement uses IF NOT EXISTS.
-- Names match Prisma's convention so a later `prisma db push` sees them as already applied.

-- ProjectLocation
CREATE INDEX IF NOT EXISTS "ProjectLocation_projectId_idx" ON "ProjectLocation" ("projectId");

-- Lookahead
CREATE INDEX IF NOT EXISTS "Lookahead_projectId_idx" ON "Lookahead" ("projectId");
CREATE INDEX IF NOT EXISTS "Lookahead_projectId_uploadDate_idx" ON "Lookahead" ("projectId", "uploadDate");

-- Activity
CREATE INDEX IF NOT EXISTS "Activity_projectId_idx" ON "Activity" ("projectId");
CREATE INDEX IF NOT EXISTS "Activity_projectId_status_idx" ON "Activity" ("projectId", "status");
CREATE INDEX IF NOT EXISTS "Activity_projectId_deletedAt_idx" ON "Activity" ("projectId", "deletedAt");
CREATE INDEX IF NOT EXISTS "Activity_lookaheadId_idx" ON "Activity" ("lookaheadId");
CREATE INDEX IF NOT EXISTS "Activity_responsibleSubcontractorId_idx" ON "Activity" ("responsibleSubcontractorId");
CREATE INDEX IF NOT EXISTS "Activity_locationId_idx" ON "Activity" ("locationId");

-- ActivityOccurrence
CREATE INDEX IF NOT EXISTS "ActivityOccurrence_activityId_idx" ON "ActivityOccurrence" ("activityId");
CREATE INDEX IF NOT EXISTS "ActivityOccurrence_plannedDate_idx" ON "ActivityOccurrence" ("plannedDate");

-- Conflict
CREATE INDEX IF NOT EXISTS "Conflict_projectId_idx" ON "Conflict" ("projectId");
CREATE INDEX IF NOT EXISTS "Conflict_projectId_status_idx" ON "Conflict" ("projectId", "status");
CREATE INDEX IF NOT EXISTS "Conflict_projectId_deletedAt_idx" ON "Conflict" ("projectId", "deletedAt");

-- Constraint
CREATE INDEX IF NOT EXISTS "Constraint_projectId_idx" ON "Constraint" ("projectId");
CREATE INDEX IF NOT EXISTS "Constraint_projectId_status_idx" ON "Constraint" ("projectId", "status");
CREATE INDEX IF NOT EXISTS "Constraint_projectId_deletedAt_idx" ON "Constraint" ("projectId", "deletedAt");

-- Delay
CREATE INDEX IF NOT EXISTS "Delay_projectId_idx" ON "Delay" ("projectId");
CREATE INDEX IF NOT EXISTS "Delay_projectId_status_idx" ON "Delay" ("projectId", "status");
CREATE INDEX IF NOT EXISTS "Delay_projectId_deletedAt_idx" ON "Delay" ("projectId", "deletedAt");

-- Alert
CREATE INDEX IF NOT EXISTS "Alert_projectId_idx" ON "Alert" ("projectId");
CREATE INDEX IF NOT EXISTS "Alert_projectId_status_idx" ON "Alert" ("projectId", "status");
CREATE INDEX IF NOT EXISTS "Alert_projectId_deletedAt_idx" ON "Alert" ("projectId", "deletedAt");
CREATE INDEX IF NOT EXISTS "Alert_assignedToId_idx" ON "Alert" ("assignedToId");

-- AuditLog
CREATE INDEX IF NOT EXISTS "AuditLog_projectId_idx" ON "AuditLog" ("projectId");
CREATE INDEX IF NOT EXISTS "AuditLog_projectId_createdAt_idx" ON "AuditLog" ("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog" ("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog" ("userId");

-- Notification
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification" ("userId");
CREATE INDEX IF NOT EXISTS "Notification_projectId_idx" ON "Notification" ("projectId");

-- AIAnalysis
CREATE INDEX IF NOT EXISTS "AIAnalysis_projectId_idx" ON "AIAnalysis" ("projectId");
