import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Subject, Topic, StudySession, Revision, Task, Project, Note, Flashcard, CalendarEvent } from '@/lib/supabase';

export function useUserData() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [subs, tops, studies, revs, tsk, proj, nts, fcs, evs] = await Promise.all([
      supabase.from('subjects').select('*').order('position'),
      supabase.from('topics').select('*').order('position'),
      supabase.from('study_sessions').select('*, subject:subjects(*), topic:topics(*)').order('studied_date', { ascending: false }),
      supabase.from('revisions').select('*, topic:topics(*), subject:subjects(*)').order('next_due_date'),
      supabase.from('tasks').select('*, project:projects(*), subject:subjects(*), subtasks(*)').order('position'),
      supabase.from('projects').select('*').order('position'),
      supabase.from('notes').select('*, subject:subjects(*), topic:topics(*)').order('updated_at', { ascending: false }),
      supabase.from('flashcards').select('*, subject:subjects(*), topic:topics(*)').order('created_at', { ascending: false }),
      supabase.from('calendar_events').select('*, subject:subjects(*)').order('start_date'),
    ]);

    setSubjects(subs.data as Subject[] ?? []);
    setTopics(tops.data as Topic[] ?? []);
    setStudySessions(studies.data as StudySession[] ?? []);
    setRevisions(revs.data as Revision[] ?? []);
    setTasks(tsk.data as Task[] ?? []);
    setProjects(proj.data as Project[] ?? []);
    setNotes(nts.data as Note[] ?? []);
    setFlashcards(fcs.data as Flashcard[] ?? []);
    setEvents(evs.data as CalendarEvent[] ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const refresh = useCallback(() => loadAll(), [loadAll]);

  // Build topic tree helper
  const getTopicTree = (subjectId: string): Topic[] => {
    const subjectTopics = topics.filter((t) => t.subject_id === subjectId);
    const buildTree = (parentId: string | null): Topic[] => {
      return subjectTopics
        .filter((t) => t.parent_id === parentId)
        .sort((a, b) => a.position - b.position)
        .map((t) => ({ ...t, children: buildTree(t.id) }));
    };
    return buildTree(null);
  };

  return {
    subjects, topics, studySessions, revisions, tasks, projects, notes, flashcards, events,
    loading, refresh, getTopicTree,
    setSubjects, setTopics, setStudySessions, setRevisions, setTasks, setProjects, setNotes, setFlashcards, setEvents,
  };
}

export type UserData = ReturnType<typeof useUserData>;
