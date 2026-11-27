import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Subject, Topic, StudySession, Revision, Task, Project, Note, Flashcard, CalendarEvent } from '@/lib/supabase';

const DATA_REFRESH_EVENT = 'studytrack:data-refresh';

type CachedUserData = {
  timestamp: number;
  flashcardDecks: import('@/lib/supabase').FlashcardDeck[];
  subjects: Subject[];
  topics: Topic[];
  studySessions: StudySession[];
  revisions: Revision[];
  tasks: Task[];
  projects: Project[];
  notes: Note[];
  flashcards: Flashcard[];
  events: CalendarEvent[];
};

// Page navigation remounts page components. Reuse recently loaded data instead
// of firing nine database queries every time the user changes sections.
const USER_DATA_CACHE = new Map<string, CachedUserData>();
const CACHE_TTL_MS = 60_000;

export function useUserData() {
  const { user } = useAuth();
  const instanceId = useId();
  const cached = user?.id ? USER_DATA_CACHE.get(user.id) : undefined;
  const cacheIsFresh = !!cached && Date.now() - cached.timestamp < CACHE_TTL_MS;
  const [subjects, setSubjects] = useState<Subject[]>(cached?.subjects ?? []);
  const [topics, setTopics] = useState<Topic[]>(cached?.topics ?? []);
  const [studySessions, setStudySessions] = useState<StudySession[]>(cached?.studySessions ?? []);
  const [revisions, setRevisions] = useState<Revision[]>(cached?.revisions ?? []);
  const [tasks, setTasks] = useState<Task[]>(cached?.tasks ?? []);
  const [projects, setProjects] = useState<Project[]>(cached?.projects ?? []);
  const [notes, setNotes] = useState<Note[]>(cached?.notes ?? []);
  const [flashcards, setFlashcards] = useState<Flashcard[]>(cached?.flashcards ?? []);
  const [flashcardDecks, setFlashcardDecks] = useState<import('@/lib/supabase').FlashcardDeck[]>(cached?.flashcardDecks ?? []);
  const [events, setEvents] = useState<CalendarEvent[]>(cached?.events ?? []);
  const [loading, setLoading] = useState(!cacheIsFresh);

  const loadAll = useCallback(async (showLoading = false) => {
    if (!user) return;
    const recent = USER_DATA_CACHE.get(user.id);
    if (showLoading && recent && Date.now() - recent.timestamp < CACHE_TTL_MS) {
      setSubjects(recent.subjects);
      setTopics(recent.topics);
      setStudySessions(recent.studySessions);
      setRevisions(recent.revisions);
      setTasks(recent.tasks);
      setProjects(recent.projects);
      setNotes(recent.notes);
      setFlashcards(recent.flashcards);
      setFlashcardDecks(recent.flashcardDecks);
      setEvents(recent.events);
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    const [subs, tops, revs, tsk, proj, nts, fcs, decks, evs] = await Promise.all([
      supabase.from('subjects').select('*').order('position'),
      supabase.from('topics').select('*').order('position'),
      supabase.from('revisions').select('*, topic:topics(*), subject:subjects(*)').order('next_due_date'),
      supabase.from('tasks').select('*, project:projects(*), subject:subjects(*), subtasks(*)').order('position'),
      supabase.from('projects').select('*').order('position'),
      supabase.from('notes').select('*, subject:subjects(*), topic:topics(*)').order('updated_at', { ascending: false }),
      supabase.from('flashcards').select('*, subject:subjects(*), topic:topics(*)').order('created_at', { ascending: false }),
      supabase.from('flashcard_decks').select('*, subject:subjects(*), topic:topics(*)').order('created_at', { ascending: false }),
      supabase.from('calendar_events').select('*, subject:subjects(*)').order('start_date'),
    ]);

    // Keep legacy session history visible if the optional multi-subject join table
    // has not yet been migrated into this Supabase project.
    const studies = await supabase.from('study_sessions')
      .select('*, subject:subjects(*), topic:topics(*), session_subjects(subject_id, subject:subjects(*))')
      .order('studied_date', { ascending: false });
    let studyRows: unknown[] = studies.data ?? [];
    if (studies.error) {
      const legacyStudies = await supabase.from('study_sessions')
        .select('*, subject:subjects(*), topic:topics(*)')
        .order('studied_date', { ascending: false });
      if (!legacyStudies.error) studyRows = legacyStudies.data ?? [];
      else console.error('Could not load study session history:', studies.error, legacyStudies.error);
    }

    const nextData: CachedUserData = {
      timestamp: Date.now(),
      subjects: (subs.data ?? []) as Subject[],
      topics: (tops.data ?? []) as Topic[],
      studySessions: studyRows as StudySession[],
      revisions: (revs.data ?? []) as Revision[],
      tasks: (tsk.data ?? []) as Task[],
      projects: (proj.data ?? []) as Project[],
      notes: (nts.data ?? []) as Note[],
      flashcards: (fcs.data ?? []) as Flashcard[],
      flashcardDecks: (decks.data ?? []) as import('@/lib/supabase').FlashcardDeck[],
      events: (evs.data ?? []) as CalendarEvent[],
    };
    USER_DATA_CACHE.set(user.id, nextData);
    setSubjects(nextData.subjects);
    setTopics(nextData.topics);
    setStudySessions(nextData.studySessions);
    setRevisions(nextData.revisions);
    setTasks(nextData.tasks);
    setProjects(nextData.projects);
    setNotes(nextData.notes);
    setFlashcards(nextData.flashcards);
    setFlashcardDecks(nextData.flashcardDecks);
    setEvents(nextData.events);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadAll(true);
  }, [loadAll]);

  // Each component has its own useUserData instance. Broadcast refreshes so
  // changes made by the AI drawer are also reflected in the currently visible
  // page (and vice versa), while avoiding a duplicate fetch in the sender.
  useEffect(() => {
    const handleDataRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string; sourceId?: string }>).detail;
      if (detail?.sourceId === instanceId) return;
      if (detail?.userId && detail.userId !== user?.id) return;
      void loadAll(false);
    };

    window.addEventListener(DATA_REFRESH_EVENT, handleDataRefresh);
    return () => window.removeEventListener(DATA_REFRESH_EVENT, handleDataRefresh);
  }, [instanceId, loadAll, user?.id]);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    window.dispatchEvent(new CustomEvent(DATA_REFRESH_EVENT, {
      detail: { userId: user.id, sourceId: instanceId },
    }));
    await loadAll(false);
  }, [instanceId, loadAll, user?.id]);

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
    subjects, topics, studySessions, revisions, tasks, projects, notes, flashcards, flashcardDecks, events,
    loading, refresh, getTopicTree,
    setSubjects, setTopics, setStudySessions, setRevisions, setTasks, setProjects, setNotes, setFlashcards, setFlashcardDecks, setEvents,
  };
}

export type UserData = ReturnType<typeof useUserData>;
