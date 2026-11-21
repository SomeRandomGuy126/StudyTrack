ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS tracking_method text NOT NULL DEFAULT 'manual';

ALTER TABLE public.study_sessions
  DROP CONSTRAINT IF EXISTS study_sessions_tracking_method_check;

ALTER TABLE public.study_sessions
  ADD CONSTRAINT study_sessions_tracking_method_check
  CHECK (tracking_method IN ('manual', 'timer'));
