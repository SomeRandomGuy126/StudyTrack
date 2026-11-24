import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserData } from '@/hooks/useUserData';
import {
  Clock, RefreshCw, CheckSquare, AlertTriangle, TrendingUp, Calendar as CalIcon,
  BookOpen, Plus, ArrowRight, Target
} from 'lucide-react';
import {
  isToday, isOverdue, isThisWeek, formatDuration, relativeDate, confidenceLabel,
  daysUntil, formatShortDate
} from '@/lib/spacedRepetition';
import { Spinner } from '@/components/ui/Common';

type Props = { onNavigate: (page: any, view?: string) => void };

export function Dashboard({ onNavigate }: Props) {
  const { profile } = useAuth();
  const data = useUserData();

  // Include every saved study session. Older database schemas may not store tracking_method,
  // so filtering to 'timer' silently hides valid sessions from the dashboard.
  const timerSessions = data.studySessions;
  const today = new Date();
  const todayStr = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const stats = useMemo(() => {
    const todayStudy = timerSessions.filter((s) => isToday(s.studied_date));
    const overdueRevisions = data.revisions.filter((r) => r.status === 'due' && isOverdue(r.next_due_date));
    const dueTodayRevisions = data.revisions.filter((r) => r.status === 'due' && isToday(r.next_due_date));
    const dueThisWeek = data.revisions.filter((r) => r.status === 'due' && isThisWeek(r.next_due_date));
    const tasksDueToday = data.tasks.filter((t) => t.status !== 'completed' && t.deadline && isToday(t.deadline));
    const upcomingDeadlines = data.tasks
      .filter((t) => t.status !== 'completed' && t.deadline && daysUntil(t.deadline) >= 0 && daysUntil(t.deadline) <= 7)
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
    const recentStudy = timerSessions.slice(0, 5);
    const weekStudyMinutes = timerSessions
      .filter((s) => isThisWeek(s.studied_date))
      .reduce((sum, s) => sum + s.duration_minutes, 0);

    return {
      todayStudy,
      overdueRevisions,
      dueTodayRevisions,
      dueThisWeek,
      tasksDueToday,
      upcomingDeadlines,
      recentStudy,
      weekStudyMinutes,
      totalStudyMinutes: timerSessions.reduce((sum, s) => sum + s.duration_minutes, 0),
      totalRevisions: data.revisions.filter((r) => r.status === 'completed').length,
    };
  }, [data]);

  const subjectProgress = useMemo(() => {
    return data.subjects.map((subject) => {
      const subjectTopics = data.topics.filter((t) => t.subject_id === subject.id);
      const subjectSessions = timerSessions.filter((s) => s.subject_id === subject.id);
      const subjectRevisions = data.revisions.filter((r) => r.subject_id === subject.id);
      const completedRevisions = subjectRevisions.filter((r) => r.status === 'completed').length;
      const avgConfidence = subjectSessions.length > 0
        ? subjectSessions.reduce((sum, s) => sum + s.confidence, 0) / subjectSessions.length
        : 0;
      return {
        subject,
        topicCount: subjectTopics.length,
        studyMinutes: subjectSessions.reduce((sum, s) => sum + s.duration_minutes, 0),
        completedRevisions,
        avgConfidence,
      };
    });
  }, [data.subjects, data.topics, timerSessions, data.revisions]);

  if (data.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={32} className="text-brand-500" />
      </div>
    );
  }

  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">
            {greeting}, {profile?.display_name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="text-secondary text-sm mt-1">{todayStr}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onNavigate('study')} className="btn btn-secondary">
            <Plus size={16} /> Start timer
          </button>
          <button onClick={() => onNavigate('tasks')} className="btn btn-primary">
            <Plus size={16} /> Add task
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Clock size={20} />}
          label="This week"
          value={formatDuration(stats.weekStudyMinutes)}
          sub="study time"
          color="#3b82f6"
        />
        <StatCard
          icon={<RefreshCw size={20} />}
          label="Due today"
          value={String(stats.dueTodayRevisions.length)}
          sub="revisions"
          color="#8b5cf6"
          onClick={() => onNavigate('revision', 'due')}
        />
        <StatCard
          icon={<AlertTriangle size={20} />}
          label="Overdue"
          value={String(stats.overdueRevisions.length)}
          sub="topics to revise"
          color="#ef4444"
          alert={stats.overdueRevisions.length > 0}
          onClick={() => onNavigate('revision', 'overdue')}
        />
        <StatCard
          icon={<CheckSquare size={20} />}
          label="Due today"
          value={String(stats.tasksDueToday.length)}
          sub="tasks"
          color="#f97316"
          onClick={() => onNavigate('tasks', 'dueToday')}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column - schedule & tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overdue revisions */}
          {stats.overdueRevisions.length > 0 && (
            <div className="card p-5 border-red-500/30">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={18} className="text-red-500" />
                <h3 className="font-semibold text-primary">Overdue revisions</h3>
                <span className="badge bg-red-500/10 text-red-600">{stats.overdueRevisions.length}</span>
              </div>
              <div className="space-y-2">
                {stats.overdueRevisions.slice(0, 4).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 rounded-lg surface-tertiary hover:border-red-500/40 transition-colors cursor-pointer"
                    onClick={() => onNavigate('revision', 'overdue')}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary truncate">{r.topic?.name}</p>
                        <p className="text-xs text-tertiary">{r.subject?.name}</p>
                      </div>
                    </div>
                    <span className="text-xs text-red-600 font-medium shrink-0">{relativeDate(r.next_due_date)}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => onNavigate('revision', 'overdue')}
                className="btn btn-ghost text-red-600 !px-0 mt-3 text-sm"
              >
                View all <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* Today's study schedule */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-brand-500" />
                <h3 className="font-semibold text-primary">Today's study & revision</h3>
              </div>
              <button onClick={() => onNavigate('study')} className="btn-ghost btn text-sm !py-1">
                View all
              </button>
            </div>
            <div className="space-y-2">
              {stats.dueTodayRevisions.length === 0 && stats.todayStudy.length === 0 ? (
                <p className="text-secondary text-sm text-center py-6">Nothing scheduled for today. Start a study timer whenever you're ready.</p>
              ) : (
                <>
                  {stats.dueTodayRevisions.map((r) => (
                    <button type="button" key={r.id} onClick={() => onNavigate('revision', 'due')} className="w-full text-left flex items-center gap-3 p-3 rounded-lg surface-tertiary hover:opacity-80 transition-opacity">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${r.subject?.color}20`, color: r.subject?.color }}>
                        <RefreshCw size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary truncate">Revise: {r.topic?.name}</p>
                        <p className="text-xs text-tertiary">{r.subject?.name}</p>
                      </div>
                      <span className="badge bg-violet-500/10 text-violet-600">Revision</span>
                    </button>
                  ))}
                  {stats.todayStudy.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg surface-tertiary">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${s.subject?.color}20`, color: s.subject?.color }}>
                        <BookOpen size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary truncate">{s.title}</p>
                        <p className="text-xs text-tertiary">{s.subject?.name} · {formatDuration(s.duration_minutes)}</p>
                      </div>
                      <span className="badge bg-brand-500/10 text-brand-600">Studied</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Upcoming deadlines */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <CalIcon size={18} className="text-orange-500" />
              <h3 className="font-semibold text-primary">Upcoming deadlines</h3>
            </div>
            <div className="space-y-2">
              {stats.upcomingDeadlines.length === 0 ? (
                <p className="text-secondary text-sm text-center py-6">No upcoming deadlines in the next 7 days.</p>
              ) : (
                stats.upcomingDeadlines.slice(0, 5).map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg surface-tertiary">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.subject?.color ?? '#64748b' }} />
                      <span className="text-sm text-primary truncate">{t.title}</span>
                    </div>
                    <span className="text-xs text-secondary shrink-0">{relativeDate(t.deadline!)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent study */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-green-500" />
                <h3 className="font-semibold text-primary">Recently studied</h3>
              </div>
              <button onClick={() => onNavigate('study')} className="btn-ghost btn text-sm !py-1">View all</button>
            </div>
            <div className="space-y-2">
              {stats.recentStudy.length === 0 ? (
                <p className="text-secondary text-sm text-center py-6">No study sessions recorded yet.</p>
              ) : (
                stats.recentStudy.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg surface-tertiary">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${s.subject?.color}20`, color: s.subject?.color }}>
                      <BookOpen size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{s.title}</p>
                      <p className="text-xs text-tertiary">{s.subject?.name} · {formatShortDate(s.studied_date)} · {confidenceLabel(s.confidence)}</p>
                    </div>
                    <span className="text-xs text-tertiary shrink-0">{formatDuration(s.duration_minutes)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right column - subject progress & stats */}
        <div className="space-y-6">
          {/* Weekly study time */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target size={18} className="text-brand-500" />
              <h3 className="font-semibold text-primary">Weekly study time</h3>
            </div>
            <div className="text-3xl font-bold text-primary mb-2">{formatDuration(stats.weekStudyMinutes)}</div>
            <div className="text-xs text-tertiary mb-3">
              Goal: {profile?.availability_hours_per_week ?? 10}h / week
            </div>
            <div className="h-2 rounded-full surface-tertiary overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (stats.weekStudyMinutes / ((profile?.availability_hours_per_week ?? 10) * 60)) * 100)}%`,
                }}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-tertiary text-xs">Total study time</p>
                <p className="text-primary font-semibold">{formatDuration(stats.totalStudyMinutes)}</p>
              </div>
              <div>
                <p className="text-tertiary text-xs">Revisions done</p>
                <p className="text-primary font-semibold">{stats.totalRevisions}</p>
              </div>
            </div>
          </div>

          {/* Subject progress */}
          <div className="card p-5">
            <h3 className="font-semibold text-primary mb-4">Subject progress</h3>
            {subjectProgress.length === 0 ? (
              <p className="text-secondary text-sm text-center py-6">Add subjects to see progress.</p>
            ) : (
              <div className="space-y-3">
                {subjectProgress.slice(0, 5).map((sp) => (
                  <div key={sp.subject.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: sp.subject.color }} />
                        <span className="text-sm text-primary truncate">{sp.subject.name}</span>
                      </div>
                      <span className="text-xs text-tertiary shrink-0">{sp.topicCount} topics</span>
                    </div>
                    <div className="h-1.5 rounded-full surface-tertiary overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, sp.avgConfidence * 20)}%`,
                          backgroundColor: sp.subject.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming revisions */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-primary">Upcoming revisions</h3>
              <button onClick={() => onNavigate('revision')} className="btn-ghost btn text-sm !py-1">View all</button>
            </div>
            <div className="space-y-2">
              {data.revisions.filter((r) => r.status === 'due' && daysUntil(r.next_due_date) >= 0).slice(0, 4).map((r) => (
                <div key={r.id} className="flex items-center justify-between p-2 rounded-lg surface-tertiary">
                  <div className="min-w-0">
                    <p className="text-sm text-primary truncate">{r.topic?.name}</p>
                    <p className="text-xs text-tertiary">{r.subject?.name}</p>
                  </div>
                  <span className="text-xs text-secondary shrink-0">{relativeDate(r.next_due_date)}</span>
                </div>
              ))}
              {data.revisions.filter((r) => r.status === 'due' && daysUntil(r.next_due_date) >= 0).length === 0 && (
                <p className="text-secondary text-sm text-center py-6">No upcoming revisions.</p>
              )}
            </div>
          </div>
        </div>
      </div>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={`card p-4 text-left w-full hover:border-brand-500/50 hover:shadow-md transition-all cursor-pointer ${alert ? 'border-red-500/30 animate-pulse-soft' : ''}`} aria-label={`${label} ${sub}: ${value}. Open details`}>
      {content}
    </button>
  ) : <div className={`card p-4 ${alert ? 'border-red-500/30 animate-pulse-soft' : ''}`}>{content}</div>;
}

function StatCard({
  icon, label, value, sub, color, alert, onClick,
}: { icon: React.ReactNode; label: string; value: string; sub: string; color: string; alert?: boolean; onClick?: () => void }) {
  const content = (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}20`, color }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-primary leading-none">{value}</p>
        <p className="text-xs text-tertiary mt-1">{label} {sub}</p>
      </div>
    </div>
  );

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`card p-4 text-left w-full hover:border-brand-500/50 hover:shadow-md transition-all cursor-pointer ${alert ? 'border-red-500/30 animate-pulse-soft' : ''}`}
      aria-label={`${label} ${sub}: ${value}. Open details`}
    >
      {content}
    </button>
  ) : (
    <div className={`card p-4 ${alert ? 'border-red-500/30 animate-pulse-soft' : ''}`}>{content}</div>
  );
}
