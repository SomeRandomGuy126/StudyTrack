-- Optional teacher organisation for each subject and attribution for each topic/subtopic.
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS teacher_names text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS teacher_name text;

COMMENT ON COLUMN public.subjects.teacher_names IS 'Teacher names associated with this subject; optional.';
COMMENT ON COLUMN public.topics.teacher_name IS 'Optional teacher attribution for this topic or subtopic.';
