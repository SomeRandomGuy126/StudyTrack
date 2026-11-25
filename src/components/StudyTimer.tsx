import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Subject, Topic } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Play, Pause, RotateCcw, Save, Timer as TimerIcon, Hourglass, Minus, Maximize2, Plus, Trash2 } from 'lucide-react';

type Props = { subjects: Subject[]; topics: Topic[]; onSaved: () => void };
type Mode = 'stopwatch' | 'countdown';
type ResumeSession = { id: string; title: string; subject_id: string; topic_id: string | null; duration_minutes: number; confidence: number; session_type: 'lesson' | 'revision' | 'uncategorised'; studied_date: string };

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export function StudyTimer(props: Props) {
  const { user } = useAuth();
  const storageKey = `studytrack:timers:${user?.id ?? 'guest'}`;
  const [timerIds, setTimerIds] = useState<number[]>(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      const parsed = saved ? JSON.parse(saved) : [1];
      return Array.isArray(parsed) && parsed.length ? parsed.slice(0, 10) : [1];
    } catch { return [1]; }
  });
  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(timerIds));
  }, [storageKey, timerIds]);
  const addTimer = () => setTimerIds((ids) => ids.length >= 10 ? ids : [...ids, Math.max(0, ...ids) + 1]);
  const removeTimer = (id: number) => setTimerIds((ids) => ids.length <= 1 ? ids : ids.filter((item) => item !== id));
  return (
    <section className="mb-6 rounded-xl border border-app p-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-primary">Study timers</h2>
          <p className="text-xs text-secondary mt-1">{timerIds.length} of 10 timers</p>
        </div>
        <button type="button" onClick={addTimer} disabled={timerIds.length >= 10} className="btn btn-primary disabled:opacity-50">
          <Plus size={16} /> Add timer
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {timerIds.map((id, index) => <TimerInstance key={id} {...props} timerNumber={index + 1} timerId={id} onRemove={() => removeTimer(id)} canRemove={timerIds.length > 1} />)}
      </div>
    </section>
  );
}

function TimerInstance({ subjects, topics, onSaved, timerNumber, timerId, onRemove, canRemove }: Props & { timerNumber: number; timerId: number; onRemove: () => void; canRemove: boolean }) {
  const { user } = useAuth();
  const storageKey = `studytrack:timer:${user?.id ?? 'guest'}:${timerId}`;
  const [savedState] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem(storageKey) ?? '{}'); }
    catch { return {}; }
  });
  const [mode, setMode] = useState<Mode>(savedState.mode ?? 'stopwatch');
  const [minutes, setMinutes] = useState<number>(savedState.minutes ?? 60);
  const [subjectId, setSubjectId] = useState<string>(savedState.subjectId ?? subjects[0]?.id ?? '');
  const [topicId, setTopicId] = useState<string>(savedState.topicId ?? '');
  const [title, setTitle] = useState<string>(savedState.title ?? '');
  const [confidence, setConfidence] = useState<number>(savedState.confidence ?? 3);
  const [sessionType, setSessionType] = useState<'lesson' | 'revision' | 'uncategorised'>(savedState.sessionType ?? 'uncategorised');
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(savedState.resumeSessionId ?? null);
  const [resumeSessions, setResumeSessions] = useState<ResumeSession[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number>(savedState.elapsedMs ?? 0);
  const [now, setNow] = useState(Date.now());
  const [startedAt, setStartedAt] = useState<number | null>(savedState.startedAt ?? null);
  const [running, setRunning] = useState<boolean>(savedState.running ?? false);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState<boolean>(savedState.finished ?? false);
  const [minimized, setMinimized] = useState<boolean>(savedState.minimized ?? false);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({
      mode, minutes, subjectId, topicId, title, confidence, sessionType, resumeSessionId, elapsedMs, startedAt, running, finished, minimized,
    }));
  }, [storageKey, mode, minutes, subjectId, topicId, title, confidence, sessionType, resumeSessionId, elapsedMs, startedAt, running, finished, minimized]);

  useEffect(() => {
    if (!user) return;
    supabase.from('study_sessions').select('id,title,subject_id,topic_id,duration_minutes,confidence,session_type,studied_date').eq('user_id', user.id).order('studied_date', { ascending: false }).limit(100).then(({ data }) => setResumeSessions((data ?? []) as ResumeSession[]));
  }, [user?.id]);
  const targetMs = Math.max(1, minutes) * 60_000;
  const actualMs = elapsedMs + (running && startedAt !== null ? now - startedAt : 0);
  const shownMs = mode === 'countdown' ? Math.max(0, targetMs - actualMs) : actualMs;
  const subjectTopics = useMemo(() => topics.filter((topic) => topic.subject_id === subjectId), [topics, subjectId]);

  useEffect(() => {
    if (!running || startedAt === null) return;
    const tick = () => {
      const current = elapsedMs + Date.now() - startedAt;
      setNow(Date.now());
      if (mode === 'countdown' && current >= targetMs) {
        setRunning(false);
        setStartedAt(null);
        setFinished(true);
        setElapsedMs(targetMs);
      }
    };
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [running, startedAt, elapsedMs, mode, targetMs]);

  const start = () => {
    if (!subjectId) return;
    setStartedAt(Date.now());
    setNow(Date.now());
    setRunning(true);
    setFinished(false);
  };

  const pause = () => {
    if (startedAt !== null) setElapsedMs((current) => current + Date.now() - startedAt);
    setStartedAt(null);
    setRunning(false);
  };

  const reset = () => {
    setRunning(false);
    setStartedAt(null);
    setElapsedMs(0);
    setFinished(false);
  };

  const save = async () => {
    if (!user || !subjectId) return;
    const duration = Math.floor(actualMs / 60_000);
    if (duration < 1) return;
    setSaving(true);
    const selectedTopic = topics.find((topic) => topic.id === topicId);
    const sessionPayload = {
      user_id: user.id,
      subject_id: subjectId,
      topic_id: topicId || null,
      title: title.trim() || selectedTopic?.name || 'Study session',
      description: mode === 'countdown' ? `Countdown target: ${minutes} minutes` : 'Stopwatch session',
      personal_notes: null,
      studied_date: (() => { const date = new Date(); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); })(),
      duration_minutes: duration,
      confidence,
      session_type: sessionType,
      tracking_method: 'timer',
    };

    let { error } = resumeSessionId
      ? await supabase.from('study_sessions').update({ duration_minutes: duration, confidence, title: sessionPayload.title, description: sessionPayload.description, session_type: sessionType }).eq('id', resumeSessionId).eq('user_id', user.id)
      : await supabase.from('study_sessions').insert(sessionPayload);

    // Older databases may not have the optional tracking_method column yet.
    // Retry without it so a schema migration gap cannot block saving study time.
    if (
      error &&
      (error.code === '42703' || error.code === 'PGRST204') &&
      error.message.toLowerCase().includes('tracking_method')
    ) {
      const legacyPayload = Object.fromEntries(
        Object.entries(sessionPayload).filter(([key]) => key !== 'tracking_method')
      );
      const retry = await supabase.from('study_sessions').insert(legacyPayload);
      error = retry.error;
    }

    setSaving(false);
    if (error) {
      console.error('Failed to save study session:', error);
      window.alert('Could not save this study session. Please try again.');
      return;
    }
    reset();
    setTitle('');
    setResumeSessionId(null);
    setElapsedMs(0);
    setSessionType('uncategorised');
    onSaved();
  };

  const disabledSettings = running || elapsedMs > 0 || finished;

  return (
    <section className="card p-4 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-3 select-none">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-primary"><TimerIcon size={15} /><span>Timer {timerNumber}</span><span className="font-mono text-brand-500 tabular-nums">{formatClock(shownMs)}</span></div>
        <div className="flex items-center gap-1">
          {minimized && !running && !finished && <button type="button" className="btn-ghost btn !p-1.5" title={elapsedMs > 0 ? "Resume" : "Start"} disabled={!subjectId} onClick={start}><Play size={15} /></button>}
          {minimized && running && <button type="button" className="btn-ghost btn !p-1.5" title="Pause" onClick={pause}><Pause size={15} /></button>}
          <button type="button" className="btn btn-secondary !px-2.5 !py-1.5 text-xs shrink-0" aria-label={minimized ? "Expand timer" : "Minimise timer"} title={minimized ? "Expand timer" : "Minimise timer"} onClick={() => setMinimized(!minimized)}>{minimized ? <Maximize2 size={14} /> : <Minus size={14} />}{minimized ? "Expand" : "Minimise"}</button>
          {canRemove && !running && elapsedMs === 0 && <button type="button" className="btn-ghost btn !p-1.5 text-red-500" title="Remove empty timer" onClick={onRemove}><Trash2 size={15} /></button>}
        </div>
      </div>
      {!minimized && <>
      <div className="flex flex-col gap-3 mb-4 min-w-0">
        <div>
          <div className="flex items-center gap-2">
            <TimerIcon size={19} className="text-brand-500" />
            <h2 className="font-semibold text-primary text-lg">Timer {timerNumber}</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 surface rounded-lg p-1 w-fit max-w-full">
          <button type="button" disabled={disabledSettings} onClick={() => { setMode('stopwatch'); reset(); }} className={`btn text-sm ${mode === 'stopwatch' ? 'btn-primary' : 'btn-ghost'}`}>
            <Hourglass size={15} /> Stopwatch
          </button>
          <button type="button" disabled={disabledSettings} onClick={() => { setMode('countdown'); reset(); }} className={`btn text-sm ${mode === 'countdown' ? 'btn-primary' : 'btn-ghost'}`}>
            <TimerIcon size={15} /> Countdown
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 min-w-0">
        <label className="text-sm text-secondary">Subject
          <select className="input mt-1" value={subjectId} disabled={disabledSettings} onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); }}>
            {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-secondary">Continue a previous session
          <select className="input mt-1" value={resumeSessionId ?? ''} disabled={disabledSettings} onChange={(e) => {
            const selected = resumeSessions.find((item) => item.id === e.target.value);
            setResumeSessionId(selected?.id ?? null);
            if (selected) { setSubjectId(selected.subject_id); setTopicId(selected.topic_id ?? ''); setTitle(selected.title); setConfidence(selected.confidence); setSessionType(selected.session_type ?? 'uncategorised'); setElapsedMs(selected.duration_minutes * 60_000); setMode('stopwatch'); setFinished(false); }
            else { setElapsedMs(0); }
          }}>
            <option value="">Start a new session</option>
            {resumeSessions.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.duration_minutes}m · {item.studied_date}</option>)}
          </select>
        </label>
        <label className="text-sm text-secondary">Topic
          <select className="input mt-1" value={topicId} disabled={disabledSettings} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">No specific topic</option>
            {subjectTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-secondary sm:col-span-2">Session name (optional)
          <input className="input mt-1" value={title} disabled={disabledSettings} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cell recognition and antigens" />
        </label>
        {mode === 'countdown' && (
          <label className="text-sm text-secondary">Duration (minutes)
            <input className="input mt-1" type="number" min="1" max="1440" value={minutes} disabled={disabledSettings} onChange={(e) => setMinutes(Math.max(1, Math.min(1440, Number(e.target.value) || 1)))} />
          </label>
        )}
        <label className="text-sm text-secondary">Session type
          <select className="input mt-1" value={sessionType} disabled={disabledSettings} onChange={(e) => setSessionType(e.target.value as 'lesson' | 'revision' | 'uncategorised')}><option value="uncategorised">Uncategorised</option><option value="lesson">Lesson</option><option value="revision">Revision</option></select>
        </label>
        <label className="text-sm text-secondary">Confidence after studying
          <select className="input mt-1" value={confidence} disabled={disabledSettings} onChange={(e) => setConfidence(Number(e.target.value))}>
            <option value={1}>Very low</option><option value={2}>Low</option><option value={3}>Okay</option><option value={4}>Good</option><option value={5}>Very good</option>
          </select>
        </label>
      </div>

      <div className="rounded-xl surface-tertiary p-4 sm:p-5 text-center min-w-0">
        <div className="text-xs uppercase tracking-wider text-tertiary mb-2">{finished ? 'Time is up' : running ? 'Timer running' : elapsedMs > 0 ? 'Paused' : mode === 'stopwatch' ? 'Ready when you are' : 'Countdown ready'}</div>
        <div className="font-mono text-3xl sm:text-4xl font-bold text-primary tabular-nums break-all" aria-live="off">{formatClock(shownMs)}</div>
        {mode === 'countdown' && <p className="text-xs text-tertiary mt-2">{formatClock(actualMs)} studied so far</p>}
        <div className="flex flex-wrap justify-center gap-2 mt-5">
          {!running && !finished && (
            <button type="button" onClick={start} disabled={!subjectId} className="btn btn-primary"><Play size={16} /> {elapsedMs > 0 ? 'Resume' : 'Start'}</button>
          )}
          {running && <button type="button" onClick={pause} className="btn btn-secondary"><Pause size={16} /> Pause</button>}
          {(elapsedMs > 0 || finished) && !running && <button type="button" onClick={reset} className="btn btn-secondary"><RotateCcw size={16} /> Reset</button>}
          {(elapsedMs >= 60_000 || finished) && !running && <button type="button" onClick={save} disabled={saving} className="btn btn-primary"><Save size={16} /> {saving ? 'Saving…' : resumeSessionId ? 'Update & finish session' : 'Finish & save session'}</button>}
        </div>
        {elapsedMs > 0 && elapsedMs < 60_000 && !running && <p className="text-xs text-tertiary mt-3">Study for at least one minute to save a session.</p>}
      </div>
      </>}
    </section>
  );
}
