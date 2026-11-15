/*
# StudyTrack - Initial Schema

## Overview
Creates the complete database schema for StudyTrack, an AI-powered student productivity platform.
All data is owner-scoped to authenticated users via row-level security.

## Tables
1. `profiles` - extends auth.users with student info (display name, education level, school, preferred study days, availability)
2. `subjects` - student subjects with colour, exam board, qualification level
3. `topics` - hierarchical topics/subtopics within subjects (self-referencing parent)
4. `study_sessions` - records of lessons/independent study (subject, topic, date, duration, confidence)
5. `revisions` - spaced-repetition revision records linked to topics
6. `projects` - task groupings (e.g. Biology revision, EPQ)
7. `tasks` - individual tasks with status, priority, deadline, subtasks
8. `subtasks` - child tasks
9. `task_tags` - tags for tasks
10. `notes` - rich-text notes organised by subject/topic
11. `flashcards` - front/back flashcards organised by subject/topic
12. `calendar_events` - standalone calendar events (lessons, exams, personal)
13. `ai_messages` - chat history for the AI assistant

## Security
- RLS enabled on every table.
- Owner-scoped CRUD policies for `authenticated` role only.
- `user_id` columns default to `auth.uid()` so inserts from the client omit the owner safely.
- Child tables (topics, study_sessions, revisions, tasks, subtasks, notes, flashcards, calendar_events, ai_messages) scope ownership through their parent's user_id or a direct user_id column.
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  education_level text,
  school text,
  preferred_study_days text[] DEFAULT '{}',
  availability_hours_per_week int DEFAULT 10,
  onboarded boolean NOT NULL DEFAULT false,
  theme text DEFAULT 'light',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- SUBJECTS
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  exam_board text,
  qualification_level text,
  icon text,
  position int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON subjects TO authenticated;
DROP POLICY IF EXISTS "subjects_select_own" ON subjects;
CREATE POLICY "subjects_select_own" ON subjects FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "subjects_insert_own" ON subjects;
CREATE POLICY "subjects_insert_own" ON subjects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "subjects_update_own" ON subjects;
CREATE POLICY "subjects_update_own" ON subjects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "subjects_delete_own" ON subjects;
CREATE POLICY "subjects_delete_own" ON subjects FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_user ON subjects(user_id);

-- TOPICS (self-referencing hierarchy)
CREATE TABLE IF NOT EXISTS topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES topics(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  position int DEFAULT 0,
  is_difficult boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON topics TO authenticated;
DROP POLICY IF EXISTS "topics_select_own" ON topics;
CREATE POLICY "topics_select_own" ON topics FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM subjects WHERE subjects.id = topics.subject_id AND subjects.user_id = auth.uid()));
DROP POLICY IF EXISTS "topics_insert_own" ON topics;
CREATE POLICY "topics_insert_own" ON topics FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM subjects WHERE subjects.id = topics.subject_id AND subjects.user_id = auth.uid()));
DROP POLICY IF EXISTS "topics_update_own" ON topics;
CREATE POLICY "topics_update_own" ON topics FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM subjects WHERE subjects.id = topics.subject_id AND subjects.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM subjects WHERE subjects.id = topics.subject_id AND subjects.user_id = auth.uid()));
DROP POLICY IF EXISTS "topics_delete_own" ON topics;
CREATE POLICY "topics_delete_own" ON topics FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM subjects WHERE subjects.id = topics.subject_id AND subjects.user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_parent ON topics(parent_id);

-- STUDY SESSIONS
CREATE TABLE IF NOT EXISTS study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  personal_notes text,
  studied_date date NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes int NOT NULL DEFAULT 0,
  confidence int NOT NULL DEFAULT 3 CHECK (confidence >= 1 AND confidence <= 5),
  attachment_url text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON study_sessions TO authenticated;
DROP POLICY IF EXISTS "study_select_own" ON study_sessions;
CREATE POLICY "study_select_own" ON study_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "study_insert_own" ON study_sessions;
CREATE POLICY "study_insert_own" ON study_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "study_update_own" ON study_sessions;
CREATE POLICY "study_update_own" ON study_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "study_delete_own" ON study_sessions;
CREATE POLICY "study_delete_own" ON study_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_study_user ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_date ON study_sessions(studied_date);
CREATE INDEX IF NOT EXISTS idx_study_subject ON study_sessions(subject_id);

-- REVISIONS (spaced repetition records)
CREATE TABLE IF NOT EXISTS revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  revision_number int NOT NULL DEFAULT 1,
  last_studied_date date NOT NULL DEFAULT CURRENT_DATE,
  last_revised_date date,
  next_due_date date NOT NULL DEFAULT (CURRENT_DATE + 2),
  interval_days int NOT NULL DEFAULT 2,
  confidence int NOT NULL DEFAULT 3 CHECK (confidence >= 1 AND confidence <= 5),
  last_recall_rating int CHECK (last_recall_rating >= 1 AND last_recall_rating <= 5),
  status text NOT NULL DEFAULT 'due' CHECK (status IN ('due','completed','skipped')),
  notes text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE revisions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON revisions TO authenticated;
DROP POLICY IF EXISTS "revisions_select_own" ON revisions;
CREATE POLICY "revisions_select_own" ON revisions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "revisions_insert_own" ON revisions;
CREATE POLICY "revisions_insert_own" ON revisions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "revisions_update_own" ON revisions;
CREATE POLICY "revisions_update_own" ON revisions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "revisions_delete_own" ON revisions;
CREATE POLICY "revisions_delete_own" ON revisions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_revisions_user ON revisions(user_id);
CREATE INDEX IF NOT EXISTS idx_revisions_due ON revisions(next_due_date);
CREATE INDEX IF NOT EXISTS idx_revisions_topic ON revisions(topic_id);

-- PROJECTS
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#3b82f6',
  icon text,
  position int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO authenticated;
DROP POLICY IF EXISTS "projects_select_own" ON projects;
CREATE POLICY "projects_select_own" ON projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "projects_insert_own" ON projects;
CREATE POLICY "projects_insert_own" ON projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "projects_update_own" ON projects;
CREATE POLICY "projects_update_own" ON projects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "projects_delete_own" ON projects;
CREATE POLICY "projects_delete_own" ON projects FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

-- TASKS
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','completed','on_hold')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  deadline date,
  tags text[] DEFAULT '{}',
  position int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON tasks TO authenticated;
DROP POLICY IF EXISTS "tasks_select_own" ON tasks;
CREATE POLICY "tasks_select_own" ON tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "tasks_insert_own" ON tasks;
CREATE POLICY "tasks_insert_own" ON tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "tasks_update_own" ON tasks;
CREATE POLICY "tasks_update_own" ON tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "tasks_delete_own" ON tasks;
CREATE POLICY "tasks_delete_own" ON tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);

-- SUBTASKS
CREATE TABLE IF NOT EXISTS subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  position int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON subtasks TO authenticated;
DROP POLICY IF EXISTS "subtasks_select_own" ON subtasks;
CREATE POLICY "subtasks_select_own" ON subtasks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = subtasks.task_id AND tasks.user_id = auth.uid()));
DROP POLICY IF EXISTS "subtasks_insert_own" ON subtasks;
CREATE POLICY "subtasks_insert_own" ON subtasks FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = subtasks.task_id AND tasks.user_id = auth.uid()));
DROP POLICY IF EXISTS "subtasks_update_own" ON subtasks;
CREATE POLICY "subtasks_update_own" ON subtasks FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = subtasks.task_id AND tasks.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = subtasks.task_id AND tasks.user_id = auth.uid()));
DROP POLICY IF EXISTS "subtasks_delete_own" ON subtasks;
CREATE POLICY "subtasks_delete_own" ON subtasks FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = subtasks.task_id AND tasks.user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);

-- NOTES
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  study_session_id uuid REFERENCES study_sessions(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  color text DEFAULT '#facc15',
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON notes TO authenticated;
DROP POLICY IF EXISTS "notes_select_own" ON notes;
CREATE POLICY "notes_select_own" ON notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notes_insert_own" ON notes;
CREATE POLICY "notes_insert_own" ON notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notes_update_own" ON notes;
CREATE POLICY "notes_update_own" ON notes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notes_delete_own" ON notes;
CREATE POLICY "notes_delete_own" ON notes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_subject ON notes(subject_id);

-- FLASHCARDS
CREATE TABLE IF NOT EXISTS flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  front text NOT NULL,
  back text NOT NULL,
  confidence int NOT NULL DEFAULT 3 CHECK (confidence >= 1 AND confidence <= 5),
  times_reviewed int NOT NULL DEFAULT 0,
  times_correct int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON flashcards TO authenticated;
DROP POLICY IF EXISTS "flashcards_select_own" ON flashcards;
CREATE POLICY "flashcards_select_own" ON flashcards FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "flashcards_insert_own" ON flashcards;
CREATE POLICY "flashcards_insert_own" ON flashcards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "flashcards_update_own" ON flashcards;
CREATE POLICY "flashcards_update_own" ON flashcards FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "flashcards_delete_own" ON flashcards;
CREATE POLICY "flashcards_delete_own" ON flashcards FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_user ON flashcards(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_subject ON flashcards(subject_id);

-- CALENDAR EVENTS
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  event_type text NOT NULL DEFAULT 'personal' CHECK (event_type IN ('study','revision','lesson','homework','coursework','exam','personal')),
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz NOT NULL DEFAULT now(),
  all_day boolean NOT NULL DEFAULT false,
  location text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON calendar_events TO authenticated;
DROP POLICY IF EXISTS "events_select_own" ON calendar_events;
CREATE POLICY "events_select_own" ON calendar_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "events_insert_own" ON calendar_events;
CREATE POLICY "events_insert_own" ON calendar_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "events_update_own" ON calendar_events;
CREATE POLICY "events_update_own" ON calendar_events FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "events_delete_own" ON calendar_events;
CREATE POLICY "events_delete_own" ON calendar_events FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_events_user ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_start ON calendar_events(start_date);

-- AI MESSAGES
CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  action_taken text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_messages TO authenticated;
DROP POLICY IF EXISTS "ai_select_own" ON ai_messages;
CREATE POLICY "ai_select_own" ON ai_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "ai_insert_own" ON ai_messages;
CREATE POLICY "ai_insert_own" ON ai_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ai_update_own" ON ai_messages;
CREATE POLICY "ai_update_own" ON ai_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ai_delete_own" ON ai_messages;
CREATE POLICY "ai_delete_own" ON ai_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_ai_user ON ai_messages(user_id);
