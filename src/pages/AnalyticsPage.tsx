import { useMemo } from 'react';
import { useUserData } from '@/hooks/useUserData';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner, EmptyState, ProgressBar, Badge } from '@/components/ui/Common';
import { formatDuration, isThisWeek, isToday, confidenceLabel, CONFIDENCE_LEVELS, formatShortDate } from '@/lib/spacedRepetition';
import {
  BarChart3, Clock, RefreshCw, BookOpen, TrendingUp, AlertTriangle,
  Target, Award, Calendar
} from 'lucide-react';

export function AnalyticsPage() {
  const data = useUserData();
  const { profile } = useAuth();
  const timerSessions = data.studySessions.filter((session) => session.tracking_method === 'timer');

  const stats = useMemo(() => {
    const totalMinutes = timerSessions.reduce((sum, s) => sum + s.duration_minutes, 0);
    const todayMinutes = timerSessions.filter((s) => isToday(s.studied_date)).reduce((sum, s) => sum + s.duration_minutes, 0);
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const yearMinutes = timerSessions.filter((s) => new Date(s.studied_date) >= yearStart).reduce((sum, s) => sum + s.duration_minutes, 0);
    const weekMinutes = timerSessions.filter((s) => isThisWeek(s.studied_date)).reduce((sum, s) => sum + s.duration_minutes, 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthMinutes = timerSessions.filter((s) => new Date(s.studied_date) >= monthStart).reduce((sum, s) => sum + s.duration_minutes, 0);
    const completedRevisions = data.revisions.filter((r) => r.status === 'completed').length;
    const overdueCount = data.revisions.filter((r) => r.status === 'due' && new Date(r.next_due_date) < new Date()).length;
    const topicsStudied = new Set(timerSessions.filter((s) => s.topic_id).map((s) => s.topic_id)).size;

    // Last 7 days study time
    const last7Days: { date: Date; minutes: number; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dayMinutes = timerSessions
        .filter((s) => {
          const sd = new Date(s.studied_date);
          return sd.toDateString() === d.toDateString();
        })
        .reduce((sum, s) => sum + s.duration_minutes, 0);
      last7Days.push({ date: d, minutes: dayMinutes, label: d.toLocaleDateString('en-GB', { weekday: 'short' }) });
    }

    // Study time by subject
    const subjectStats = data.subjects.map((subject) => {
      const sessions = timerSessions.filter((s) => s.subject_id === subject.id);
      const minutes = sessions.reduce((sum, s) => sum + s.duration_minutes, 0);
      const avgConfidence = sessions.length > 0 ? sessions.reduce((sum, s) => sum + s.confidence, 0) / sessions.length : 0;
      const revisions = data.revisions.filter((r) => r.subject_id === subject.id);
      const completed = revisions.filter((r) => r.status === 'completed').length;
      const overdue = revisions.filter((r) => r.status === 'due' && new Date(r.next_due_date) < new Date()).length;
      const topics = data.topics.filter((t) => t.subject_id === subject.id).length;
      return { subject, minutes, sessions: sessions.length, avgConfidence, completed, overdue, topics };
    }).sort((a, b) => b.minutes - a.minutes);

    // Confidence distribution
    const confidenceDist = [0, 0, 0, 0, 0];
    timerSessions.forEach((s) => { confidenceDist[s.confidence - 1]++; });

    // Revision performance over last 10 completed
    const recentRevisions = data.revisions
      .filter((r) => r.status === 'completed' && r.last_recall_rating)
      .sort((a, b) => new Date(b.completed_at ?? b.created_at).getTime() - new Date(a.completed_at ?? a.created_at).getTime())
      .slice(0, 10)
      .reverse();

    // Monthly study time (last 6 months)
    const monthlyData: { label: string; minutes: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const minutes = timerSessions
        .filter((s) => {
          const sd = new Date(s.studied_date);
          return sd >= d && sd < nextMonth;
        })
        .reduce((sum, s) => sum + s.duration_minutes, 0);
      monthlyData.push({ label: d.toLocaleDateString('en-GB', { month: 'short' }), minutes });
    }

    return {
      totalMinutes, todayMinutes, weekMinutes, monthMinutes, yearMinutes, completedRevisions, overdueCount, topicsStudied,
      last7Days, subjectStats, confidenceDist, recentRevisions, monthlyData,
      totalSessions: timerSessions.length,
    };
  }, [data]);

  if (data.loading) {
    return <div className="flex items-center justify-center py-20"><Spinner size={32} className="text-brand-500" /></div>;
  }

  const maxDayMinutes = Math.max(...stats.last7Days.map((d) => d.minutes), 60);
  const maxMonthMinutes = Math.max(...stats.monthlyData.map((d) => d.minutes), 60);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Analytics</h1>
        <p className="text-secondary text-sm mt-1">Track your study progress and identify areas needing attention</p>
      </div>

      {timerSessions.length === 0 && data.revisions.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<BarChart3 size={48} />}
            title="No data to analyse yet"
            description="Start a stopwatch or countdown to build your study-time analytics. Revision statistics remain available separately."
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<Clock size={20} />} label="Today" value={formatDuration(stats.todayMinutes)} color="#3b82f6" />
            <StatCard icon={<Calendar size={20} />} label="This week" value={formatDuration(stats.weekMinutes)} color="#0ea5e9" />
            <StatCard icon={<Calendar size={20} />} label="This month" value={formatDuration(stats.monthMinutes)} color="#22c55e" />
            <StatCard icon={<TrendingUp size={20} />} label="This year" value={formatDuration(stats.yearMinutes)} color="#8b5cf6" />
            <StatCard icon={<Clock size={20} />} label="All-time study" value={formatDuration(stats.totalMinutes)} color="#3b82f6" />
            <StatCard icon={<RefreshCw size={20} />} label="Revisions done" value={String(stats.completedRevisions)} color="#8b5cf6" />
            <StatCard icon={<AlertTriangle size={20} />} label="Overdue topics" value={String(stats.overdueCount)} color="#ef4444" alert={stats.overdueCount > 0} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Weekly study chart */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={18} className="text-brand-500" />
                <h3 className="font-semibold text-primary">Study time - last 7 days</h3>
              </div>
              <div className="flex items-end justify-between gap-2 h-40">
                {stats.last7Days.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="text-xs text-tertiary">{d.minutes > 0 ? formatDuration(d.minutes) : ''}</div>
                    <div className="w-full flex items-end h-28">
                      <div
                        className="w-full rounded-t-md transition-all duration-500 hover:opacity-80"
                        style={{
                          height: `${(d.minutes / maxDayMinutes) * 100}%`,
                          backgroundColor: isToday(d.date) ? '#3b82f6' : '#93c5fd',
                          minHeight: d.minutes > 0 ? '4px' : '0',
                        }}
                      />
                    </div>
                    <span className="text-xs text-secondary">{d.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-app flex justify-between text-sm">
                <span className="text-secondary">This week total</span>
                <span className="font-semibold text-primary">{formatDuration(stats.weekMinutes)}</span>
              </div>
            </div>

            {/* Monthly study chart */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className="text-green-500" />
                <h3 className="font-semibold text-primary">Study time - last 6 months</h3>
              </div>
              <div className="flex items-end justify-between gap-2 h-40">
                {stats.monthlyData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="text-xs text-tertiary">{d.minutes > 0 ? formatDuration(d.minutes) : ''}</div>
                    <div className="w-full flex items-end h-28">
                      <div
                        className="w-full rounded-t-md transition-all duration-500 hover:opacity-80"
                        style={{
                          height: `${(d.minutes / maxMonthMinutes) * 100}%`,
                          backgroundColor: '#22c55e',
                          minHeight: d.minutes > 0 ? '4px' : '0',
                        }}
                      />
                    </div>
                    <span className="text-xs text-secondary">{d.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-app flex justify-between text-sm">
                <span className="text-secondary">Monthly average</span>
                <span className="font-semibold text-primary">{formatDuration(Math.round(stats.monthlyData.reduce((sum, d) => sum + d.minutes, 0) / 6))}</span>
              </div>
            </div>
          </div>

          {/* Subject breakdown */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen size={18} className="text-brand-500" />
              <h3 className="font-semibold text-primary">Subject-by-subject progress</h3>
            </div>
            {stats.subjectStats.length === 0 ? (
              <p className="text-secondary text-sm text-center py-6">No subjects to analyse.</p>
            ) : (
              <div className="space-y-4">
                {stats.subjectStats.map((ss) => (
                  <div key={ss.subject.id}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ss.subject.color }} />
                        <span className="text-sm font-medium text-primary">{ss.subject.name}</span>
                        <Badge color={ss.subject.color}>{ss.topics} topics</Badge>
                        {ss.overdue > 0 && <Badge color="#ef4444">{ss.overdue} overdue</Badge>}
                      </div>
                      <span className="text-xs text-tertiary">{formatDuration(ss.minutes)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <ProgressBar value={ss.avgConfidence} max={5} color={ss.subject.color} />
                      </div>
                      <span className="text-xs text-tertiary w-20 text-right">{confidenceLabel(Math.round(ss.avgConfidence))}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-tertiary">
                      <span>{ss.sessions} sessions</span>
                      <span>{ss.completed} revisions done</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Confidence distribution */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target size={18} className="text-orange-500" />
                <h3 className="font-semibold text-primary">Confidence distribution</h3>
              </div>
              <div className="space-y-3">
                {CONFIDENCE_LEVELS.map((c, i) => {
                  const count = stats.confidenceDist[i];
                  const total = timerSessions.length || 1;
                  const pct = (count / total) * 100;
                  return (
                    <div key={c.value}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-secondary">{c.label}</span>
                        <span className="text-xs text-tertiary">{count} sessions</span>
                      </div>
                      <ProgressBar value={pct} color={c.color} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Revision performance */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Award size={18} className="text-violet-500" />
                <h3 className="font-semibold text-primary">Recent revision performance</h3>
              </div>
              {stats.recentRevisions.length === 0 ? (
                <p className="text-secondary text-sm text-center py-6">Complete some revisions to see performance.</p>
              ) : (
                <div className="space-y-2">
                  {stats.recentRevisions.map((r) => {
                    const rating = r.last_recall_rating!;
                    const ratingInfo = CONFIDENCE_LEVELS[rating - 1];
                    return (
                      <div key={r.id} className="flex items-center justify-between p-2 rounded-lg surface-tertiary">
                        <div className="min-w-0">
                          <p className="text-sm text-primary truncate">{r.topic?.name}</p>
                          <p className="text-xs text-tertiary">{r.subject?.name} · {formatShortDate(r.completed_at ?? r.created_at)}</p>
                        </div>
                        <Badge color={ratingInfo?.color}>{ratingInfo?.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Insight banner */}
          <div className="card p-5 bg-gradient-to-r from-brand-500/10 to-violet-500/10">
            <div className="flex items-start gap-3">
              <TrendingUp size={20} className="text-brand-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-primary mb-1">Insights</h3>
                <div className="space-y-1 text-sm text-secondary">
                  {stats.overdueCount > 0 && (
                    <p>You have <strong className="text-red-600">{stats.overdueCount} overdue topics</strong>. Priorise these in your next study session.</p>
                  )}
                  {stats.weekMinutes < (profile?.availability_hours_per_week ?? 10) * 30 && (
                    <p>You've studied <strong>{formatDuration(stats.weekMinutes)}</strong> this week — below your target of {profile?.availability_hours_per_week ?? 10} hours.</p>
                  )}
                  {stats.weekMinutes >= (profile?.availability_hours_per_week ?? 10) * 60 && (
                    <p>Great work! You've met your weekly study goal of {profile?.availability_hours_per_week ?? 10} hours.</p>
                  )}
                  {stats.subjectStats.length > 0 && stats.subjectStats[0].avgConfidence < 3 && (
                    <p>Your top subject <strong>{stats.subjectStats[0].subject.name}</strong> has low average confidence. Consider reviewing fundamentals.</p>
                  )}
                  {stats.totalSessions > 0 && (
                    <p>You've logged <strong>{stats.totalSessions}</strong> study sessions across <strong>{stats.topicsStudied}</strong> topics.</p>
                  )}
                </div>
                <p className="text-xs text-tertiary mt-3">Remember: study time is a measure of effort, not academic ability. Consistency matters more than volume.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, alert }: { icon: React.ReactNode; label: string; value: string; color: string; alert?: boolean }) {
  return (
    <div className={`card p-4 ${alert ? 'border-red-500/30' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}20`, color }}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold text-primary leading-none">{value}</p>
          <p className="text-xs text-tertiary mt-1">{label}</p>
        </div>
      </div>
    </div>
  );
}
