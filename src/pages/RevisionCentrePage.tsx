import { useState, useMemo } from 'react';
import { useUserData } from '@/hooks/useUserData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Spinner, ConfidenceDots, Badge } from '@/components/ui/Common';
import {
  isToday, isOverdue, isThisWeek, relativeDate, formatShortDate,
  confidenceLabel, calculateNextInterval, CONFIDENCE_LEVELS
} from '@/lib/spacedRepetition';
import type { Revision } from '@/lib/supabase';
import {
  RefreshCw, AlertTriangle, CheckCircle2, Clock, Calendar as CalIcon,
  ChevronRight, Edit2, Check
} from 'lucide-react';

type Tab = 'due' | 'overdue' | 'week' | 'upcoming' | 'completed';

export function RevisionCentrePage({ initialTab = 'overdue' }: { initialTab?: 'due' | 'overdue' }) {
  const data = useUserData();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [completeTarget, setCompleteTarget] = useState<Revision | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Revision | null>(null);

  if (data.loading) {
    return <div className="flex items-center justify-center py-20"><Spinner size={32} className="text-brand-500" /></div>;
  }

  const tabs: { id: Tab; label: string; filter: (r: Revision) => boolean }[] = [
    { id: 'overdue', label: 'Overdue', filter: (r) => r.status === 'due' && isOverdue(r.next_due_date) },
    { id: 'due', label: 'Due Today', filter: (r) => r.status === 'due' && isToday(r.next_due_date) },
    { id: 'week', label: 'This Week', filter: (r) => r.status === 'due' && isThisWeek(r.next_due_date) && !isToday(r.next_due_date) && !isOverdue(r.next_due_date) },
    { id: 'upcoming', label: 'Upcoming', filter: (r) => r.status === 'due' && !isThisWeek(r.next_due_date) && !isOverdue(r.next_due_date) },
    { id: 'completed', label: 'Completed', filter: (r) => r.status === 'completed' },
  ];

  const counts = tabs.reduce((acc, t) => {
    acc[t.id] = data.revisions.filter(t.filter).length;
    return acc;
  }, {} as Record<Tab, number>);

  const currentTab = tabs.find((t) => t.id === tab)!;
  const filteredRevisions = data.revisions.filter(currentTab.filter)
    .sort((a, b) => {
      if (tab === 'completed') {
        return new Date(b.completed_at ?? b.created_at).getTime() - new Date(a.completed_at ?? a.created_at).getTime();
      }
      return new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime();
    });

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Revision Centre</h1>
        <p className="text-secondary text-sm mt-1">Spaced repetition system - topics are automatically scheduled for revision</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Overdue" count={counts.overdue} icon={<AlertTriangle size={18} />} color="#ef4444" />
        <SummaryCard label="Due today" count={counts.due} icon={<Clock size={18} />} color="#8b5cf6" />
        <SummaryCard label="This week" count={counts.week} icon={<CalIcon size={18} />} color="#3b82f6" />
        <SummaryCard label="Completed" count={counts.completed} icon={<CheckCircle2 size={18} />} color="#22c55e" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 surface rounded-lg p-1 mb-4 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`btn !py-1.5 text-sm whitespace-nowrap ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`}
          >
            {t.label}
            {counts[t.id] > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${tab === t.id ? 'bg-white/20' : 'surface-tertiary'}`}>
                {counts[t.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Revision list */}
      {filteredRevisions.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<RefreshCw size={48} />}
            title={tab === 'completed' ? 'No completed revisions yet' : 'Nothing to revise here'}
            description={tab === 'overdue' ? 'Great! You\'re up to date with all your revisions.' : 'Log study sessions with topics to build your revision schedule.'}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRevisions.map((r) => (
            <RevisionCard
              key={r.id}
              revision={r}
              onComplete={() => setCompleteTarget(r)}
              onReschedule={() => setRescheduleTarget(r)}
            />
          ))}
        </div>
      )}

      {completeTarget && (
        <CompleteRevisionModal
          revision={completeTarget}
          userId={user!.id}
          onClose={() => setCompleteTarget(null)}
          onSaved={() => { setCompleteTarget(null); data.refresh(); }}
        />
      )}

      {rescheduleTarget && (
        <RescheduleModal
          revision={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onSaved={() => { setRescheduleTarget(null); data.refresh(); }}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, count, icon, color }: { label: string; count: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}20`, color }}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-primary leading-none">{count}</p>
          <p className="text-xs text-tertiary mt-1">{label}</p>
        </div>
      </div>
    </div>
  );
}

function RevisionCard({ revision, onComplete, onReschedule }: {
  revision: Revision;
  onComplete: () => void;
  onReschedule: () => void;
}) {
  const overdue = revision.status === 'due' && isOverdue(revision.next_due_date);
  const completed = revision.status === 'completed';

  return (
    <div className={`card p-4 group hover:shadow-md transition-all ${overdue ? 'border-red-500/30' : ''}`}>
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${revision.subject?.color}20`, color: revision.subject?.color }}
        >
          <RefreshCw size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-primary truncate">{revision.topic?.name}</p>
            {overdue && <Badge color="#ef4444">Overdue</Badge>}
            {completed && <Badge color="#22c55e">Done</Badge>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-tertiary">
            <span>{revision.subject?.name}</span>
            <span>·</span>
            <span>Revision #{revision.revision_number + (completed ? 1 : 0)}</span>
            <span>·</span>
            <span>{completed ? `Completed ${formatShortDate(revision.completed_at ?? revision.created_at)}` : relativeDate(revision.next_due_date)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!completed && (
            <>
              <button onClick={onComplete} className="btn btn-primary text-sm !py-1.5">
                <Check size={14} /> Complete
              </button>
              <button onClick={onReschedule} className="btn-ghost btn !p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>
      {!completed && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-app">
          <div className="flex items-center gap-2">
            <span className="text-xs text-tertiary">Confidence:</span>
            <ConfidenceDots value={revision.confidence} size={10} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-tertiary">Interval:</span>
            <span className="text-xs text-secondary">{revision.interval_days}d</span>
          </div>
        </div>
      )}
    </div>
  );
}

function CompleteRevisionModal({ revision, userId, onClose, onSaved }: {
  revision: Revision;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [recallRating, setRecallRating] = useState(3);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleComplete = async () => {
    setSaving(true);
    const newRevisionNumber = revision.revision_number + 1;
    const topic = await supabase.from('topics').select('is_difficult').eq('id', revision.topic_id).maybeSingle();
    const isDifficult = topic.data?.is_difficult ?? false;

    const nextInterval = calculateNextInterval(newRevisionNumber, revision.confidence, recallRating, isDifficult);
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + nextInterval);

    // Mark current revision as completed
    await supabase.from('revisions').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      last_revised_date: new Date().toISOString().split('T')[0],
      last_recall_rating: recallRating,
      notes: notes || null,
    }).eq('id', revision.id);

    // Create next revision record
    await supabase.from('revisions').insert({
      user_id: userId,
      topic_id: revision.topic_id,
      subject_id: revision.subject_id,
      revision_number: newRevisionNumber,
      last_studied_date: revision.last_studied_date,
      last_revised_date: new Date().toISOString().split('T')[0],
      next_due_date: nextDue.toISOString().split('T')[0],
      interval_days: nextInterval,
      confidence: revision.confidence,
      status: 'due',
    });

    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title="Complete revision" size="sm">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-secondary mb-1">Topic</p>
          <p className="font-medium text-primary">{revision.topic?.name}</p>
          <p className="text-xs text-tertiary">{revision.subject?.name}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-2">How well did you remember it?</label>
          <div className="space-y-2">
            {CONFIDENCE_LEVELS.map((c) => (
              <button
                key={c.value}
                onClick={() => setRecallRating(c.value)}
                className={`flex items-center gap-3 w-full p-3 rounded-lg transition-all ${
                  recallRating === c.value ? 'ring-2 ring-brand-500 surface-tertiary' : 'surface-tertiary hover:opacity-80'
                }`}
              >
                <div className="w-5 h-5 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="text-sm text-primary">{c.label}</span>
                {recallRating === c.value && <Check size={16} className="text-brand-500 ml-auto" />}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Notes (optional)</label>
          <textarea className="input min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you struggle with? What went well?" />
        </div>
        <div className="bg-brand-500/10 rounded-lg p-3 text-sm text-secondary">
          Next revision will be scheduled in <span className="font-semibold text-brand-600">{calculateNextInterval(revision.revision_number + 1, revision.confidence, recallRating, false)} days</span>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={handleComplete} disabled={saving} className="btn btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : 'Mark complete'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RescheduleModal({ revision, onClose, onSaved }: {
  revision: Revision;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [newDate, setNewDate] = useState(revision.next_due_date);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const today = new Date();
    const due = new Date(newDate);
    const interval = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    await supabase.from('revisions').update({
      next_due_date: newDate,
      interval_days: Math.max(1, interval),
    }).eq('id', revision.id);
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title="Reschedule revision" size="sm">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-secondary mb-1">Topic</p>
          <p className="font-medium text-primary">{revision.topic?.name}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">New due date</label>
          <input type="date" className="input" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : 'Reschedule'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
