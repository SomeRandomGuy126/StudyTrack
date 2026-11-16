-- Allow multiple teachers per subject and an optional teacher per topic/subtopic.
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS teacher_names text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS teacher_name text;
