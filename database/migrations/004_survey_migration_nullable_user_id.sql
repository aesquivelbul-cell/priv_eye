-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 004 — Allow survey-migrated rows in predictions table
--
-- The predictions table was created with user_id NOT NULL, which prevents
-- inserting prediction rows for survey respondents who have no auth account.
-- This migration makes user_id nullable so survey-migrated rows can exist.
--
-- HOW TO RUN:
--   1. Go to your Supabase project → SQL Editor
--   2. Paste and run this file
--   3. Safe to run multiple times (IF EXISTS / IF NOT EXISTS guards)
-- ─────────────────────────────────────────────────────────────────────────────

-- Make user_id nullable in predictions (survey rows have no auth user)
ALTER TABLE public.predictions
  ALTER COLUMN user_id DROP NOT NULL;

-- Add a source tag so we can tell migrated rows from live submissions
ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'live';
-- 'live' = submitted via app, 'survey' = migrated from survey_responses

ALTER TABLE public.daily_logs
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'live';

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS idx_predictions_source ON public.predictions(source);
CREATE INDEX IF NOT EXISTS idx_daily_logs_source  ON public.daily_logs(source);

-- Backfill existing survey rows in daily_logs (those with user_id IS NULL)
UPDATE public.daily_logs
SET    source = 'survey'
WHERE  user_id IS NULL
  AND  (source IS NULL OR source = 'live');

COMMENT ON COLUMN public.predictions.source IS
  'live = submitted via the EyeGuard app; survey = migrated from survey_responses by the admin migration route';
COMMENT ON COLUMN public.daily_logs.source IS
  'live = submitted via the EyeGuard app; survey = migrated from survey_responses by the admin migration route';
