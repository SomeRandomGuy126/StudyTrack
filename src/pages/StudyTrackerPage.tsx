import { useState, useMemo, useEffect } from 'react';
import { useUserData } from '@/hooks/useUserData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { StudyTimer } from '@/components/StudyTimer';
import { EmptyState, Spinner, ConfidenceDots, Badge } from '@/components/ui/Common';
import { formatDuration, formatShortDate, formatDate, confidenceLabel, getNextDueDate } from '@/lib/spacedRepetition';
import type { StudySession } from '@/lib/supabase';
import {
  Clock, List, Table as TableIcon, Calendar as CalIcon, BookOpen,
  Edit2, Trash2, Search
} from 'lucide-react';

type View = 'list' | 'table' | 'calendar' | 'subject';

export function StudyTrackerPage() {
  const data = useUserData();
  const { user } = useAuth();
  const [view, setView] = useState<View>('list');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StudySession | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(25);

  const filtered = useMemo(() => {
    return data.studySessions.filter((s) => {
      if (filterSubject !== 'all' && s.subject_id !== filterSubject) return false;
      if (filterType !== 'all' && s.session_type !== filterType) return false;
      if (search && !s.title.toLowerCase().includes(search.toLowerCase()) && !s.subject?.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data.studySessions, search, filterSubject, filterType]);

  if (data.loading) {
    return <div className="flex items-center justify-center py-20"><Spinner size={32} className="text-brand-500" /></div>;
  }

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('study_sessions').delete().eq('id', deleteId);
    setDeleteId(null);
    data.refresh();
  };

  const handleClearHistory = async () => {
    if (!user) return;
    const { error } = await supabase.from('study_sessions').delete().eq('user_id', user.id);
    if (!error) {
      setConfirmClearHistory(false);
      data.refresh();
    }
  };

  const views = [
    { id: 'list' as View, label: 'List', icon: List },
    { id: 'table' as View, label: 'Table', icon: TableIcon },
    { id: 'calendar' as View, label: 'Calendar', icon: CalIcon },
    { id: 'subject' as View, label: 'By Subject', icon: BookOpen },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Study Tracker</h1>
          <p className="text-secondary text-sm mt-1">Track focused study time with a stopwatch or countdown</p>
        </div>
      </div>

      <StudyTimer subjects={data.subjects} topics={data.topics} onSaved={data.refresh} />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
          <input className="input pl-10" placeholder="Search sessions..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-48" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
          <option value="all">All subjects</option>
          {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="input sm:w-40" value={filterType} onChange={(e) => setFilterType(e.target.value)}><option value="all">All session types</option><option value="lesson">Lessons</option><option value="revision">Revision</option><option value="uncategorised">Uncategorised</option></select>
        {data.studySessions.length > 0 && (
          <button type="button" onClick={() => setConfirmClearHistory(true)} className="btn btn-secondary text-red-500">Clear history</button>
        )}
        <div className="flex gap-1 surface rounded-lg p-1">
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`btn !py-1.5 !px-3 text-sm ${view === v.id ? 'btn-primary' : 'btn-ghost'}`}
            >
              <v.icon size={16} /> <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Clock size={48} />}
            title="No study sessions yet"
            description="Start a stopwatch or countdown above. Completed timer sessions will appear here."
          />
        </div>
      ) : view === 'list' ? (
        <ListView sessions={filtered.slice(0, visibleCount)} onEdit={(s) => { setEditing(s); setShowModal(true); }} onDelete={(id) => setDeleteId(id)} onConfidenceChange={async (s, confidence) => { await supabase.from('study_sessions').update({ confidence }).eq('id', s.id); data.refresh(); }} />
      ) : view === 'table' ? (
        <TableView sessions={filtered.slice(0, visibleCount)} onEdit={(s) => { setEditing(s); setShowModal(true); }} onDelete={(id) => setDeleteId(id)} onConfidenceChange={async (s, confidence) => { await supabase.from('study_sessions').update({ confidence }).eq('id', s.id); data.refresh(); }} />
      ) : view === 'calendar' ? (
        <CalendarView sessions={filtered} onEdit={(s) => { setEditing(s); setShowModal(true); }} />
      ) : (
        <SubjectView sessions={filtered.slice(0, visibleCount)} subjects={data.subjects} onEdit={(s) => { setEditing(s); setShowModal(true); }} onDelete={(id) => setDeleteId(id)} />
      )}
      {filtered.length > visibleCount && <div className="flex justify-center mt-4"><button className="btn btn-secondary" onClick={() => setVisibleCount((n) => n + 25)}>Load more sessions ({filtered.length - visibleCount} remaining)</button></div>}

      {showModal && (
        <StudySessionModal
          session={editing}
          subjects={data.subjects}
          topics={data.topics}
          userId={user!.id}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); data.refresh(); }}
        />
      )}

      <ConfirmDialog
        open={confirmClearHistory}
        onClose={() => setConfirmClearHistory(false)}
        onConfirm={handleClearHistory}
        title="Clear all study history?"
        message="This permanently deletes every saved study session, including timer sessions. This cannot be undone."
        confirmLabel="Clear all history"
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete study session"
        message="Are you sure you want to delete this study session?"
        confirmLabel="Delete"
      />
    </div>
  );
}

function ListView({ sessions, onEdit, onDelete }: {
  sessions: StudySession[];
  onEdit: (s: StudySession) => void;
  onDelete: (id: string) => void;
  onConfidenceChange: (s: StudySession, confidence: number) => void;
}) {
  return (
    <div className="space-y-2">
      {sessions.map((s) => (
        <div key={s.id} role="button" tabIndex={0} onClick={() => onEdit(s)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onEdit(s); }} className="card p-4 group hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${s.subject?.color}20`, color: s.subject?.color }}>
              <BookOpen size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-primary truncate">{s.title}</p>
                  <p className="text-xs text-tertiary mt-0.5">
                    {s.subject?.name} {s.topic ? `· ${s.topic.name}` : ''} · {formatDate(s.studied_date)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="badge" style={{ backgroundColor: `${s.subject?.color}15`, color: s.subject?.color }}>
                    {formatDuration(s.duration_minutes)}
                  </span>
                  <span className={`badge ${s.session_type === 'lesson' ? 'bg-sky-500/15 text-sky-400' : s.session_type === 'revision' ? 'bg-violet-500/15 text-violet-400' : 'bg-slate-500/15 text-secondary'}`}>{s.session_type === 'uncategorised' ? 'Uncategorised' : s.session_type === 'lesson' ? 'Lesson' : 'Revision'}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(s); }} className="btn-ghost btn !p-1"><Edit2 size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(s.id); }} className="btn-ghost btn !p-1 text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
              {s.description && <p className="text-sm text-secondary mt-2 line-clamp-2">{s.description}</p>}
              <div className="flex items-center gap-3 mt-2">
                <div onClick={(e) => e.stopPropagation()}><ConfidenceDots value={s.confidence} onChange={(v) => onConfidenceChange(s, v)} size={12} /></div>
                <span className="text-xs text-tertiary">{confidenceLabel(s.confidence)}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TableView({ sessions, onEdit, onDelete }: {
  sessions: StudySession[];
  onEdit: (s: StudySession) => void;
  onDelete: (id: string) => void;
  onConfidenceChange: (s: StudySession, confidence: number) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="surface-tertiary">
            <tr>
              <th className="text-left p-3 font-medium text-secondary">Date</th>
              <th className="text-left p-3 font-medium text-secondary">Title</th>
              <th className="text-left p-3 font-medium text-secondary">Subject</th>
              <th className="text-left p-3 font-medium text-secondary">Topic</th>
              <th className="text-left p-3 font-medium text-secondary">Duration</th>
              <th className="text-left p-3 font-medium text-secondary">Type</th>
              <th className="text-left p-3 font-medium text-secondary">Confidence</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} onClick={() => onEdit(s)} className="border-t border-app hover:surface-tertiary transition-colors group cursor-pointer">
                <td className="p-3 text-secondary whitespace-nowrap">{formatShortDate(s.studied_date)}</td>
                <td className="p-3 text-primary font-medium">{s.title}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.subject?.color }} />
                    <span className="text-secondary">{s.subject?.name}</span>
                  </div>
                </td>
                <td className="p-3 text-secondary">{s.topic?.name ?? '—'}</td>
                <td className="p-3 text-secondary whitespace-nowrap">{formatDuration(s.duration_minutes)}</td>
                <td className="p-3"><span className={`badge ${s.session_type === 'lesson' ? 'bg-sky-500/15 text-sky-400' : s.session_type === 'revision' ? 'bg-violet-500/15 text-violet-400' : 'bg-slate-500/15 text-secondary'}`}>{s.session_type === 'uncategorised' ? 'Uncategorised' : s.session_type === 'lesson' ? 'Lesson' : 'Revision'}</span></td>
                <td className="p-3" onClick={(e) => e.stopPropagation()}><ConfidenceDots value={s.confidence} onChange={(v) => onConfidenceChange(s, v)} size={10} /></td>
                <td className="p-3">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(s)} className="btn-ghost btn !p-1"><Edit2 size={14} /></button>
                    <button onClick={() => onDelete(s.id)} className="btn-ghost btn !p-1 text-red-500"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CalendarView({ sessions, onEdit }: {
  sessions: StudySession[];
  onEdit: (s: StudySession) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startDay = monthStart.getDay() || 7;
  const days: (Date | null)[] = [];
  for (let i = 1; i < startDay; i++) days.push(null);
  for (let d = 1; d <= monthEnd.getDate(); d++) days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d));

  const sessionsByDate = useMemo(() => {
    const map: Record<string, StudySession[]> = {};
    sessions.forEach((s) => {
      const key = s.studied_date;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [sessions]);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-primary">
          {currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex gap-1">
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="btn btn-secondary !p-2">‹</button>
          <button onClick={() => setCurrentMonth(new Date())} className="btn btn-secondary text-sm">Today</button>
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="btn btn-secondary !p-2">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-tertiary py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = day.toISOString().split('T')[0];
          const daySessions = sessionsByDate[dateStr] ?? [];
          const isToday = new Date().toDateString() === day.toDateString();
          return (
            <div
              key={i}
              className={`min-h-[70px] p-1.5 rounded-lg surface-tertiary ${isToday ? 'ring-1 ring-brand-500' : ''}`}
            >
              <p className={`text-xs ${isToday ? 'text-brand-600 font-bold' : 'text-secondary'}`}>{day.getDate()}</p>
              <div className="space-y-0.5 mt-1">
                {daySessions.slice(0, 2).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onEdit(s)}
                    className="block w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate hover:opacity-80"
                    style={{ backgroundColor: `${s.subject?.color}25`, color: s.subject?.color }}
                  >
                    {s.title}
                  </button>
                ))}
                {daySessions.length > 2 && <p className="text-[10px] text-tertiary px-1">+{daySessions.length - 2} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubjectView({ sessions, subjects, onEdit, onDelete }: {
  sessions: StudySession[];
  subjects: any[];
  onEdit: (s: StudySession) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {subjects.map((subject: any) => {
        const subSessions = sessions.filter((s) => s.subject_id === subject.id);
        if (subSessions.length === 0) return null;
        const totalMinutes = subSessions.reduce((sum, s) => sum + s.duration_minutes, 0);
        return (
          <div key={subject.id} className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${subject.color}20`, color: subject.color }}>
                  <BookOpen size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-primary">{subject.name}</h3>
                  <p className="text-xs text-tertiary">{subSessions.length} sessions · {formatDuration(totalMinutes)}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {subSessions.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg surface-tertiary group">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{s.title}</p>
                    <p className="text-xs text-tertiary">{s.topic?.name ?? 'No topic'} · {formatShortDate(s.studied_date)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ConfidenceDots value={s.confidence} size={10} />
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEdit(s)} className="btn-ghost btn !p-1"><Edit2 size={14} /></button>
                      <button onClick={() => onDelete(s.id)} className="btn-ghost btn !p-1 text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
              {subSessions.length > 5 && <p className="text-xs text-tertiary text-center pt-2">+ {subSessions.length - 5} more sessions</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StudySessionModal({ session, subjects, topics, userId, onClose, onSaved }: {
  session: StudySession | null;
  subjects: any[];
  topics: any[];
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const draftKey = `studytrack:study-session-draft:${userId}:${session?.id ?? 'new'}`;
  const [savedDraft] = useState<Partial<{
    subjectId: string; topicId: string; title: string; description: string;
    personalNotes: string; studiedDate: string; duration: number; confidence: number;
  }>>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(draftKey) ?? '{}');
    } catch {
      return {};
    }
  });
  const [subjectId, setSubjectId] = useState(session?.subject_id ?? savedDraft.subjectId ?? subjects[0]?.id ?? '');
  const [topicId, setTopicId] = useState(session?.topic_id ?? savedDraft.topicId ?? '');
  const [title, setTitle] = useState(session?.title ?? savedDraft.title ?? '');
  const [description, setDescription] = useState(session?.description ?? savedDraft.description ?? '');
  const [personalNotes, setPersonalNotes] = useState(session?.personal_notes ?? savedDraft.personalNotes ?? '');
  const [studiedDate, setStudiedDate] = useState(session?.studied_date ?? savedDraft.studiedDate ?? new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState(session?.duration_minutes ?? savedDraft.duration ?? 60);
  const [confidence, setConfidence] = useState(session?.confidence ?? savedDraft.confidence ?? 3);
  const [sessionType, setSessionType] = useState(session?.session_type ?? 'uncategorised');
  const [activity, setActivity] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Keep unfinished work safe when the page unmounts, the tab changes, or the browser reloads.
  useEffect(() => {
    window.localStorage.setItem(draftKey, JSON.stringify({
      subjectId, topicId, title, description, personalNotes, studiedDate, duration, confidence,
    }));
  }, [draftKey, subjectId, topicId, title, description, personalNotes, studiedDate, duration, confidence]);

  const closeAndDiscardDraft = () => {
    window.localStorage.removeItem(draftKey);
    onClose();
  };

  useEffect(() => {
    if (!session) return;
    supabase.from('study_session_activity').select('*').eq('session_id', session.id).order('changed_at', { ascending: false }).then(({ data: rows }) => setActivity(rows ?? []));
  }, [session?.id]);

  const subjectTopics = topics.filter((t) => t.subject_id === subjectId);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      subject_id: subjectId,
      topic_id: topicId || null,
      title,
      description: description || null,
      personal_notes: personalNotes || null,
      studied_date: studiedDate,
      duration_minutes: duration,
      confidence,
      session_type: sessionType,
    };

    if (session) {
      await supabase.from('study_sessions').update(payload).eq('id', session.id);
    } else {
      await supabase.from('study_sessions').insert({ ...payload, user_id: userId });
    }

    // Create/update revision record for this topic
    if (topicId && subjectId) {
      const existingRevision = await supabase
        .from('revisions')
        .select('*')
        .eq('topic_id', topicId)
        .eq('status', 'due')
        .maybeSingle();

      const topic = topics.find((t) => t.id === topicId);
      const isDifficult = topic?.is_difficult ?? false;
      const nextDue = getNextDueDate(new Date(studiedDate), 0, confidence, null, isDifficult);

      if (existingRevision.data) {
        // Update: this study session counts as a study, reset revision chain
        await supabase.from('revisions').update({
          last_studied_date: studiedDate,
          confidence,
          next_due_date: nextDue.toISOString().split('T')[0],
          interval_days: Math.round((nextDue.getTime() - new Date(studiedDate).getTime()) / (1000 * 60 * 60 * 24)),
        }).eq('id', existingRevision.data.id);
      } else {
        await supabase.from('revisions').insert({
          user_id: userId,
          topic_id: topicId,
          subject_id: subjectId,
          revision_number: 0,
          last_studied_date: studiedDate,
          next_due_date: nextDue.toISOString().split('T')[0],
          interval_days: Math.round((nextDue.getTime() - new Date(studiedDate).getTime()) / (1000 * 60 * 60 * 24)),
          confidence,
          status: 'due',
        });
      }
    }

    window.localStorage.removeItem(draftKey);
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={closeAndDiscardDraft} title={session ? 'Edit study session' : 'Log study session'} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Subject</label>
            <select className="input" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); }}>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Topic (optional)</label>
            <select className="input" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="">No specific topic</option>
              {subjectTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Session type</label>
          <select className="input" value={sessionType} onChange={(e) => setSessionType(e.target.value as 'lesson' | 'revision' | 'uncategorised')}><option value="uncategorised">Uncategorised</option><option value="lesson">Lesson</option><option value="revision">Revision</option></select>
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mitosis lesson" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Date studied</label>
            <input type="date" className="input" value={studiedDate} onChange={(e) => setStudiedDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Duration (minutes)</label>
            <input type="number" className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min="1" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-2">Confidence level</label>
          <div className="flex items-center gap-3">
            <ConfidenceDots value={confidence} onChange={setConfidence} size={24} />
            <span className="text-sm text-secondary">{confidenceLabel(confidence)}</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">What was covered</label>
          <textarea className="input min-h-[60px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the lesson or study session" />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Personal notes</label>
          <textarea className="input min-h-[60px]" value={personalNotes} onChange={(e) => setPersonalNotes(e.target.value)} placeholder="Any personal notes, things to remember, questions..." />
        </div>
        {session && <div className="border-t border-app pt-4 mt-2"><h3 className="font-semibold text-primary mb-3">Activity history</h3>{activity.length === 0 ? <p className="text-sm text-tertiary">No changes recorded yet.</p> : <div className="space-y-3 max-h-56 overflow-y-auto">{activity.map((entry) => <div key={entry.id} className="text-sm border-l-2 border-brand-500 pl-3"><p className="text-xs text-tertiary">{new Date(entry.changed_at).toLocaleString()}</p><p className="font-medium text-primary capitalize">{entry.field_name.replaceAll('_', ' ')} changed</p><p className="text-secondary">{String(entry.old_value ?? 'Empty')} → {String(entry.new_value ?? 'Empty')}</p></div>)}</div>}</div>}
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={closeAndDiscardDraft} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving || !title.trim() || !subjectId} className="btn btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : 'Save session'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
