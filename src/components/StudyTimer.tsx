import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Subject, Topic } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Play, Pause, RotateCcw, Save, Timer as TimerIcon, Stopwatch } from 'lucide-react';

type Props = { subjects: Subject[]; topics: Topic[]; onSaved: () => void };
type Mode = 'stopwatch' | 'countdown';

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export function StudyTimer({ subjects, topics, onSaved }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('stopwatch');
  const [minutes, setMinutes] = useState(60);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const [topicId, setTopicId] = useState('');
  const [title, setTitle] = useState('');
  const [confidence, setConfidence] = useState(3);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);

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
    const { error } = await supabase.from('study_sessions').insert({
      user_id: user.id,
      subject_id: subjectId,
      topic_id: topicId || null,
      title: title.trim() || selectedTopic?.name || 'Study session',
      description: mode === 'countdown' ? `Countdown target: ${minutes} minutes` : 'Stopwatch session',
      personal_notes: null,
      studied_date: (() => { const date = new Date(); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); })(),
      duration_minutes: duration,
      confidence,
      tracking_method: 'timer',
    });
    setSaving(false);
    if (error) {
      window.alert('Could not save this study session. Please try again.');
      return;
    }
    reset();
    setTitle('');
    onSaved();
  };

  const disabledSettings = running || elapsedMs > 0 || finished;

  return (
    <section className="card p-5 lg:p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <TimerIcon size={19} className="text-brand-500" />
            <h2 className="font-semibold text-primary text-lg">Study timer</h2>
          </div>
          <p className="text-sm text-secondary mt-1">Only time recorded here contributes to your study totals.</p>
        </div>
        <div className="flex gap-1 surface rounded-lg p-1">
          <button type="button" disabled={disabledSettings} onClick={() => { setMode('stopwatch'); reset(); }} className={`btn text-sm ${mode === 'stopwatch' ? 'btn-primary' : 'btn-ghost'}`}>
            <Stopwatch size={15} /> Stopwatch
          </button>
          <button type="button" disabled={disabledSettings} onClick={() => { setMode('countdown'); reset(); }} className={`btn text-sm ${mode === 'countdown' ? 'btn-primary' : 'btn-ghost'}`}>
            <TimerIcon size={15} /> Countdown
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3 mb-5">
        <label className="text-sm text-secondary">Subject
          <select className="input mt-1" value={subjectId} disabled={disabledSettings} onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); }}>
            {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-secondary">Topic
          <select className="input mt-1" value={topicId} disabled={disabledSettings} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">No specific topic</option>
            {subjectTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-secondary md:col-span-2">Session name (optional)
          <input className="input mt-1" value={title} disabled={disabledSettings} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cell recognition and antigens" />
        </label>
        {mode === 'countdown' && (
          <label className="text-sm text-secondary">Duration (minutes)
            <input className="input mt-1" type="number" min="1" max="1440" value={minutes} disabled={disabledSettings} onChange={(e) => setMinutes(Math.max(1, Math.min(1440, Number(e.target.value) || 1)))} />
          </label>
        )}
        <label className="text-sm text-secondary">Confidence after studying
          <select className="input mt-1" value={confidence} disabled={disabledSettings} onChange={(e) => setConfidence(Number(e.target.value))}>
            <option value={1}>Very low</option><option value={2}>Low</option><option value={3}>Okay</option><option value={4}>Good</option><option value={5}>Very good</option>
          </select>
        </label>
      </div>

      <div className="rounded-xl surface-tertiary p-5 text-center">
        <div className="text-xs uppercase tracking-wider text-tertiary mb-2">{finished ? 'Time is up' : running ? 'Timer running' : elapsedMs > 0 ? 'Paused' : mode === 'stopwatch' ? 'Ready when you are' : 'Countdown ready'}</div>
        <div className="font-mono text-4xl sm:text-5xl font-bold text-primary tabular-nums" aria-live="off">{formatClock(shownMs)}</div>
        {mode === 'countdown' && <p className="text-xs text-tertiary mt-2">{formatClock(actualMs)} studied so far</p>}
        <div className="flex flex-wrap justify-center gap-2 mt-5">
          {!running && !finished && (
            <button type="button" onClick={start} disabled={!subjectId} className="btn btn-primary"><Play size={16} /> {elapsedMs > 0 ? 'Resume' : 'Start'}</button>
          )}
          {running && <button type="button" onClick={pause} className="btn btn-secondary"><Pause size={16} /> Pause</button>}
          {(elapsedMs > 0 || finished) && !running && <button type="button" onClick={reset} className="btn btn-secondary"><RotateCcw size={16} /> Reset</button>}
          {(elapsedMs >= 60_000 || finished) && !running && <button type="button" onClick={save} disabled={saving} className="btn btn-primary"><Save size={16} /> {saving ? 'Saving…' : 'Finish & save session'}</button>}
        </div>
        {elapsedMs > 0 && elapsedMs < 60_000 && !running && <p className="text-xs text-tertiary mt-3">Study for at least one minute to save a session.</p>}
      </div>
    </section>
  );
}
