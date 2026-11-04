-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 005 — Admin Notifications Table
--
-- Creates the admin_notifications table used by:
--   - app/api/admin/notifications/route.ts  (admin sends notifications)
--   - app/api/notifications/route.ts        (user reads their notifications)
--   - components/notification-bell.tsx      (UI polling)
--
-- Also creates the admin_audit_logs table used by lib/admin-audit.ts.
--
-- HOW TO RUN:
--   Supabase SQL Editor → paste → Run
--   Safe to run multiple times (IF NOT EXISTS guards throughout)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Admin Notifications ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  severity   VARCHAR(20) NOT NULL DEFAULT 'info',   -- info | high | critical
  read       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_user_id
  ON public.admin_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_read
  ON public.admin_notifications(user_id, read);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Users can read and mark-as-read their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.admin_notifications;
CREATE POLICY "Users can view own notifications"
  ON public.admin_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only service role (admin client) can insert/update/delete
DROP POLICY IF EXISTS "Service role manages notifications" ON public.admin_notifications;
CREATE POLICY "Service role manages notifications"
  ON public.admin_notifications FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ── Admin Audit Logs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_user_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  target_email    TEXT,
  event_type      TEXT        NOT NULL,
  description     TEXT        NOT NULL DEFAULT '',
  event_data      JSONB       NOT NULL DEFAULT '{}',
  actor_id        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_user
  ON public.admin_audit_logs(target_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_email
  ON public.admin_audit_logs(target_email);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_event_type
  ON public.admin_audit_logs(event_type);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs(created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write audit logs (admins use the API, not direct access)
DROP POLICY IF EXISTS "Service role manages audit logs" ON public.admin_audit_logs;
CREATE POLICY "Service role manages audit logs"
  ON public.admin_audit_logs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
