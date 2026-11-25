-- Classify study sessions and keep an automatic, owner-scoped change history.
ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'uncategorised';

ALTER TABLE public.study_sessions
  DROP CONSTRAINT IF EXISTS study_sessions_session_type_check;

ALTER TABLE public.study_sessions
  ADD CONSTRAINT study_sessions_session_type_check
  CHECK (session_type IN ('lesson', 'revision', 'uncategorised'));

CREATE TABLE IF NOT EXISTS public.study_session_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_session_activity_session_changed
  ON public.study_session_activity(session_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_session_activity_user
  ON public.study_session_activity(user_id);

ALTER TABLE public.study_session_activity ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.study_session_activity TO authenticated;

DROP POLICY IF EXISTS "study_session_activity_select_own" ON public.study_session_activity;
CREATE POLICY "study_session_activity_select_own"
  ON public.study_session_activity
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.log_study_session_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed_field text;
  old_json jsonb;
  new_json jsonb;
BEGIN
  IF (select auth.uid()) IS DISTINCT FROM NEW.user_id THEN
    RETURN NEW;
  END IF;

  FOREACH changed_field IN ARRAY ARRAY[
    'title', 'subject_id', 'topic_id', 'studied_date',
    'duration_minutes', 'confidence', 'session_type',
    'description', 'personal_notes'
  ]
  LOOP
    old_json := to_jsonb(OLD) -> changed_field;
    new_json := to_jsonb(NEW) -> changed_field;
    IF old_json IS DISTINCT FROM new_json THEN
      INSERT INTO public.study_session_activity
        (session_id, user_id, field_name, old_value, new_value)
      VALUES
        (NEW.id, NEW.user_id, changed_field, old_json, new_json);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS study_sessions_log_changes ON public.study_sessions;
CREATE TRIGGER study_sessions_log_changes
  AFTER UPDATE ON public.study_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_study_session_changes();
