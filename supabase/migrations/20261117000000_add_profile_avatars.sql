-- Optional user profile photos for StudyTrack.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 3145728, ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 3145728,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

-- Public URLs are readable. All mutations are restricted to the user's own folder.
DROP POLICY IF EXISTS "StudyTrack avatar select own" ON storage.objects;
CREATE POLICY "StudyTrack avatar select own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "StudyTrack avatar insert own" ON storage.objects;
CREATE POLICY "StudyTrack avatar insert own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "StudyTrack avatar update own" ON storage.objects;
CREATE POLICY "StudyTrack avatar update own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "StudyTrack avatar delete own" ON storage.objects;
CREATE POLICY "StudyTrack avatar delete own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
