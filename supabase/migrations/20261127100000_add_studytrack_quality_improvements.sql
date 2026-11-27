-- StudyTrack improvements: mixed-subject sessions, named flashcard decks, and persistent note images.

-- A session may cover no single subject, or multiple subjects via the join table below.
ALTER TABLE public.study_sessions
  ALTER COLUMN subject_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.session_subjects (
  session_id uuid NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_session_subjects_subject
  ON public.session_subjects(subject_id);

ALTER TABLE public.session_subjects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.session_subjects TO authenticated;

DROP POLICY IF EXISTS "session_subjects_select_own" ON public.session_subjects;
CREATE POLICY "session_subjects_select_own"
  ON public.session_subjects FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.study_sessions ss
      WHERE ss.id = session_subjects.session_id
        AND ss.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = session_subjects.subject_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "session_subjects_insert_own" ON public.session_subjects;
CREATE POLICY "session_subjects_insert_own"
  ON public.session_subjects FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.study_sessions ss
      WHERE ss.id = session_subjects.session_id
        AND ss.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = session_subjects.subject_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "session_subjects_delete_own" ON public.session_subjects;
CREATE POLICY "session_subjects_delete_own"
  ON public.session_subjects FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.study_sessions ss
      WHERE ss.id = session_subjects.session_id
        AND ss.user_id = (SELECT auth.uid())
    )
  );

-- Named decks keep the flashcard landing page organised instead of showing every card.
CREATE TABLE IF NOT EXISTS public.flashcard_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcard_decks TO authenticated;

DROP POLICY IF EXISTS "flashcard_decks_select_own" ON public.flashcard_decks;
CREATE POLICY "flashcard_decks_select_own" ON public.flashcard_decks
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "flashcard_decks_insert_own" ON public.flashcard_decks;
CREATE POLICY "flashcard_decks_insert_own" ON public.flashcard_decks
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "flashcard_decks_update_own" ON public.flashcard_decks;
CREATE POLICY "flashcard_decks_update_own" ON public.flashcard_decks
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "flashcard_decks_delete_own" ON public.flashcard_decks;
CREATE POLICY "flashcard_decks_delete_own" ON public.flashcard_decks
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS deck_id uuid REFERENCES public.flashcard_decks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_flashcards_deck
  ON public.flashcards(deck_id);

-- Keep note images in a private Storage bucket; only the owning user can read or manage their folder.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'note-images',
  'note-images',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

DROP POLICY IF EXISTS "note_images_select_own" ON storage.objects;
CREATE POLICY "note_images_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'note-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "note_images_insert_own" ON storage.objects;
CREATE POLICY "note_images_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'note-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "note_images_update_own" ON storage.objects;
CREATE POLICY "note_images_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'note-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'note-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "note_images_delete_own" ON storage.objects;
CREATE POLICY "note_images_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'note-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
