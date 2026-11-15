/*
# StudyTrack - AI Learning Centre tables

## Overview
Adds storage for AI-generated learning content (Magic Import, flashcard decks, tutor sessions)
so every AI resource is connected to the student's subjects and topics.

## New Tables
1. `ai_content` - generated notes/quizzes/summaries/lessons
   - id, user_id (owner, defaults to auth.uid()), subject_id, topic_id (nullable links)
   - kind: 'notes' | 'quiz' | 'summary' | 'lesson' | 'research'
   - title, source_type (pdf/ppt/youtube/text/notes/image/research/tutor)
   - source_url, content (jsonb - structured generated content)
   - created_at, updated_at
2. `tutor_messages` - chat history for the Interactive Tutor
   - id, user_id, session_id (uuid grouping a lesson conversation)
   - role: 'tutor' | 'student', content, created_at

## Security
- RLS enabled, owner-scoped CRUD for authenticated users.
- user_id defaults to auth.uid() so client inserts omit the owner.
*/

CREATE TABLE IF NOT EXISTS ai_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('notes','quiz','summary','lesson','research')),
  title text NOT NULL,
  source_type text,
  source_url text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE ai_content ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_content TO authenticated;
DROP POLICY IF EXISTS "ai_content_select_own" ON ai_content;
CREATE POLICY "ai_content_select_own" ON ai_content FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "ai_content_insert_own" ON ai_content;
CREATE POLICY "ai_content_insert_own" ON ai_content FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ai_content_update_own" ON ai_content;
CREATE POLICY "ai_content_update_own" ON ai_content FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ai_content_delete_own" ON ai_content;
CREATE POLICY "ai_content_delete_own" ON ai_content FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_ai_content_user ON ai_content(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_content_subject ON ai_content(subject_id);

CREATE TABLE IF NOT EXISTS tutor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('tutor','student')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE tutor_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON tutor_messages TO authenticated;
DROP POLICY IF EXISTS "tutor_messages_select_own" ON tutor_messages;
CREATE POLICY "tutor_messages_select_own" ON tutor_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "tutor_messages_insert_own" ON tutor_messages;
CREATE POLICY "tutor_messages_insert_own" ON tutor_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "tutor_messages_update_own" ON tutor_messages;
CREATE POLICY "tutor_messages_update_own" ON tutor_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "tutor_messages_delete_own" ON tutor_messages;
CREATE POLICY "tutor_messages_delete_own" ON tutor_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_tutor_messages_user_session ON tutor_messages(user_id, session_id);
