import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  education_level: string | null;
  school: string | null;
  preferred_study_days: string[];
  availability_hours_per_week: number;
  onboarded: boolean;
  theme: string;
  ai_tone: string | null;
  ai_depth: string | null;
  created_at: string;
  updated_at: string;
};

export type Subject = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  exam_board: string | null;
  qualification_level: string | null;
  teacher_names: string[];
  icon: string | null;
  position: number;
  created_at: string;
};

export type Topic = {
  id: string;
  subject_id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  position: number;
  is_difficult: boolean;
  teacher_name: string | null;
  created_at: string;
  children?: Topic[];
};

export type StudySession = {
  id: string;
  user_id: string;
  subject_id: string;
  topic_id: string | null;
  title: string;
  description: string | null;
  personal_notes: string | null;
  studied_date: string;
  duration_minutes: number;
  tracking_method: 'manual' | 'timer';
  session_type: 'lesson' | 'revision' | 'uncategorised';
  confidence: number;
  attachment_url: string | null;
  created_at: string;
  subject?: Subject;
  topic?: Topic;
};

export type StudySessionActivity = {
  id: string;
  session_id: string;
  user_id: string;
  field_name: string;
  old_value: unknown;
  new_value: unknown;
  changed_at: string;
};

export type Revision = {
  id: string;
  user_id: string;
  topic_id: string;
  subject_id: string;
  revision_number: number;
  last_studied_date: string;
  last_revised_date: string | null;
  next_due_date: string;
  interval_days: number;
  confidence: number;
  last_recall_rating: number | null;
  status: 'due' | 'completed' | 'skipped';
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  topic?: Topic;
  subject?: Subject;
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  position: number;
  created_at: string;
};

export type Task = {
  id: string;
  user_id: string;
  project_id: string | null;
  subject_id: string | null;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'completed' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline: string | null;
  tags: string[];
  position: number;
  created_at: string;
  completed_at: string | null;
  project?: Project;
  subject?: Subject;
  subtasks?: Subtask[];
};

export type Subtask = {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
};

export type Note = {
  id: string;
  user_id: string;
  subject_id: string | null;
  topic_id: string | null;
  study_session_id: string | null;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  subject?: Subject;
  topic?: Topic;
};

export type Flashcard = {
  id: string;
  user_id: string;
  subject_id: string | null;
  topic_id: string | null;
  front: string;
  back: string;
  confidence: number;
  times_reviewed: number;
  times_correct: number;
  created_at: string;
  subject?: Subject;
  topic?: Topic;
};

export type CalendarEvent = {
  id: string;
  user_id: string;
  subject_id: string | null;
  title: string;
  description: string | null;
  event_type: 'study' | 'revision' | 'lesson' | 'homework' | 'coursework' | 'exam' | 'personal';
  start_date: string;
  end_date: string;
  all_day: boolean;
  location: string | null;
  created_at: string;
  subject?: Subject;
};

export type AiMessage = {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  action_taken: string | null;
  created_at: string;
};
