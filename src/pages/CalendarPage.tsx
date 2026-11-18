import { useState, useMemo } from 'react';
import { useUserData } from '@/hooks/useUserData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState, Spinner } from '@/components/ui/Common';
import { EVENT_TYPES, formatShortDate } from '@/lib/spacedRepetition';
import type { CalendarEvent } from '@/lib/supabase';
import {
  Calendar as CalIcon, Plus, ChevronLeft, ChevronRight, Clock,
  Edit2, Trash2, BookOpen, RefreshCw
} from 'lucide-react';

type View = 'month' | 'week' | 'day';

export function CalendarPage() {
  const data = useUserData();
  const { user } = useAuth();
  const [view, setView] = useState<View>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Merge study sessions, revisions, and tasks into calendar events
  const allEvents = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      date: string;
      endDate?: string;
      type: string;
      color: string;
      source: 'event' | 'study' | 'revision' | 'task';
      startTime?: string;
    }> = [];

    data.events.forEach((e) => {
      const typeInfo = EVENT_TYPES.find((t) => t.value === e.event_type);
      items.push({
        id: e.id,
        title: e.title,
        date: e.start_date,
        endDate: e.end_date,
        type: e.event_type,
        color: e.subject?.color ?? typeInfo?.color ?? '#64748b',
        source: 'event',
        startTime: new Date(e.start_date).toTimeString().slice(0, 5),
      });
    });

    data.studySessions.forEach((s) => {
      items.push({
        id: s.id,
        title: s.title,
        date: new Date(s.studied_date).toISOString(),
        type: 'study',
        color: s.subject?.color ?? '#3b82f6',
        source: 'study',
      });
    });

    data.revisions.filter((r) => r.status === 'due').forEach((r) => {
      items.push({
        id: r.id,
        title: `Revise: ${r.topic?.name}`,
        date: new Date(r.next_due_date).toISOString(),
        type: 'revision',
        color: '#8b5cf6',
        source: 'revision',
      });
    });

    data.tasks.filter((t) => t.deadline && t.status !== 'completed').forEach((t) => {
      items.push({
        id: t.id,
        title: `Due: ${t.title}`,
        date: new Date(t.deadline ?? new Date()).toISOString(),
        type: 'homework',
        color: t.subject?.color ?? '#f97316',
        source: 'task',
      });
    });

    return items;
  }, [data.events, data.studySessions, data.revisions, data.tasks]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('calendar_events').delete().eq('id', deleteId);
    setDeleteId(null);
    data.refresh();
  };

  const navigate = (dir: number) => {
    if (view === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1));
    } else if (view === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + dir * 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + dir);
      setCurrentDate(d);
    }
  };

  const headerLabel = useMemo(() => {
    if (view === 'month') return currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    if (view === 'day') return currentDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const start = new Date(currentDate);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }, [view, currentDate]);

  if (data.loading) {
    return <div className="flex items-center justify-center py-20"><Spinner size={32} className="text-brand-500" /></div>;
  }

  const eventsForDate = (date: Date) => {
    const dateStr = date.toDateString();
    return allEvents.filter((e) => new Date(e.date).toDateString() === dateStr);
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Calendar</h1>
          <p className="text-secondary text-sm mt-1">All your study sessions, revisions, deadlines and events</p>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn btn-primary">
          <Plus size={16} /> Add event
        </button>
      </div>

      <div className="card p-4">
        {/* Controls */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="btn btn-secondary !p-2"><ChevronLeft size={18} /></button>
            <h3 className="font-semibold text-primary text-lg px-2">{headerLabel}</h3>
            <button onClick={() => navigate(1)} className="btn btn-secondary !p-2"><ChevronRight size={18} /></button>
            <button onClick={() => setCurrentDate(new Date())} className="btn btn-secondary text-sm ml-2">Today</button>
          </div>
          <div className="flex gap-1 surface rounded-lg p-1">
            {(['day', 'week', 'month'] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`btn !py-1.5 text-sm capitalize ${view === v ? 'btn-primary' : 'btn-ghost'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center flex-wrap gap-3 mb-4 text-xs text-tertiary">
          {EVENT_TYPES.map((t) => (
            <div key={t.value} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
              <span>{t.label}</span>
            </div>
          ))}
        </div>

        {/* Month view */}
        {view === 'month' && (
          <MonthView currentDate={currentDate} eventsForDate={eventsForDate} onEventClick={(e) => {
            const event = data.events.find((ev) => ev.id === e.id);
            if (event) { setEditing(event); setShowModal(true); }
          }} onDateClick={(d) => { setSelectedDate(d); setEditing(null); setShowModal(true); }} />
        )}

        {/* Week view */}
        {view === 'week' && (
          <WeekView currentDate={currentDate} eventsForDate={eventsForDate} onEventClick={(e) => {
            const event = data.events.find((ev) => ev.id === e.id);
            if (event) { setEditing(event); setShowModal(true); }
          }} />
        )}

        {/* Day view */}
        {view === 'day' && (
          <DayView currentDate={currentDate} eventsForDate={eventsForDate} onEventClick={(e) => {
            const event = data.events.find((ev) => ev.id === e.id);
            if (event) { setEditing(event); setShowModal(true); }
          }} />
        )}
      </div>

      {/* Upcoming events list */}
      <div className="mt-6">
        <h3 className="font-semibold text-primary mb-3">Upcoming events</h3>
        <div className="space-y-2">
          {data.events
            .filter((e) => new Date(e.start_date) >= new Date(new Date().toDateString()))
            .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
            .slice(0, 8)
            .map((e) => {
              const typeInfo = EVENT_TYPES.find((t) => t.value === e.event_type);
              return (
                <div key={e.id} className="card p-3 flex items-center gap-3 group">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${typeInfo?.color}20`, color: typeInfo?.color }}>
                    <CalIcon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{e.title}</p>
                    <p className="text-xs text-tertiary">{formatShortDate(e.start_date)} · {typeInfo?.label}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditing(e); setShowModal(true); }} className="btn-ghost btn !p-1"><Edit2 size={14} /></button>
                    <button onClick={() => setDeleteId(e.id)} className="btn-ghost btn !p-1 text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          {data.events.filter((e) => new Date(e.start_date) >= new Date(new Date().toDateString())).length === 0 && (
            <p className="text-secondary text-sm text-center py-6">No upcoming events.</p>
          )}
        </div>
      </div>

      {showModal && (
        <EventModal
          event={editing}
          subjects={data.subjects}
          userId={user!.id}
          defaultDate={selectedDate}
          onClose={() => { setShowModal(false); setSelectedDate(null); }}
          onSaved={() => { setShowModal(false); setSelectedDate(null); data.refresh(); }}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete event"
        message="Are you sure you want to delete this event?"
        confirmLabel="Delete"
      />
    </div>
  );
}

function MonthView({ currentDate, eventsForDate, onEventClick, onDateClick }: {
  currentDate: Date;
  eventsForDate: (d: Date) => any[];
  onEventClick: (e: any) => void;
  onDateClick: (d: string) => void;
}) {
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDay = monthStart.getDay() || 7;
  const days: (Date | null)[] = [];
  for (let i = 1; i < startDay; i++) days.push(null);
  for (let d = 1; d <= monthEnd.getDate(); d++) days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), d));

  return (
    <>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-tertiary py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (!day) return <div key={i} />;
          const dayEvents = eventsForDate(day);
          const isToday = new Date().toDateString() === day.toDateString();
          return (
            <div
              key={i}
              onClick={() => onDateClick(day.toISOString().split('T')[0])}
              className={`min-h-[90px] p-1.5 rounded-lg surface-tertiary cursor-pointer hover:opacity-80 transition-opacity ${isToday ? 'ring-1 ring-brand-500' : ''}`}
            >
              <p className={`text-xs ${isToday ? 'text-brand-600 font-bold' : 'text-secondary'}`}>{day.getDate()}</p>
              <div className="space-y-0.5 mt-1">
                {dayEvents.slice(0, 3).map((e) => (
                  <button
                    key={e.id + e.source}
                    onClick={(ev) => { ev.stopPropagation(); onEventClick(e); }}
                    className="block w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate hover:opacity-70"
                    style={{ backgroundColor: `${e.color}25`, color: e.color }}
                  >
                    {e.title}
                  </button>
                ))}
                {dayEvents.length > 3 && <p className="text-[10px] text-tertiary px-1">+{dayEvents.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function WeekView({ currentDate, eventsForDate, onEventClick }: {
  currentDate: Date;
  eventsForDate: (d: Date) => any[];
  onEventClick: (e: any) => void;
}) {
  const day = currentDate.getDay() || 7;
  const start = new Date(currentDate);
  start.setDate(start.getDate() - day + 1);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d, i) => {
        const dayEvents = eventsForDate(d);
        const isToday = new Date().toDateString() === d.toDateString();
        return (
          <div key={i} className={`min-h-[200px] surface-tertiary rounded-lg p-2 ${isToday ? 'ring-1 ring-brand-500' : ''}`}>
            <p className={`text-sm font-medium mb-2 ${isToday ? 'text-brand-600' : 'text-primary'}`}>
              {d.toLocaleDateString('en-GB', { weekday: 'short' })}
            </p>
            <p className="text-xs text-tertiary mb-2">{d.getDate()}</p>
            <div className="space-y-1">
              {dayEvents.map((e) => (
                <button
                  key={e.id + e.source}
                  onClick={() => onEventClick(e)}
                  className="block w-full text-left text-xs px-2 py-1.5 rounded truncate hover:opacity-80"
                  style={{ backgroundColor: `${e.color}20`, color: e.color }}
                >
                  {e.title}
                </button>
              ))}
              {dayEvents.length === 0 && <p className="text-xs text-tertiary text-center py-4">No events</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({ currentDate, eventsForDate, onEventClick }: {
  currentDate: Date;
  eventsForDate: (d: Date) => any[];
  onEventClick: (e: any) => void;
}) {
  const dayEvents = eventsForDate(currentDate);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="max-h-[500px] overflow-y-auto">
      <div className="space-y-0.5">
        {hours.map((h) => {
          const hourEvents = dayEvents.filter((e) => {
            const eventDate = new Date(e.date);
            return eventDate.getHours() === h;
          });
          const noTimeEvents = h === 8 && dayEvents.filter((e) => !e.startTime).filter((e) => new Date(e.date).getHours() === 0);
          return (
            <div key={h} className="flex gap-3 min-h-[40px]">
              <div className="w-16 text-xs text-tertiary pt-1 text-right shrink-0">
                {h === 0 ? '' : `${h}:00`}
              </div>
              <div className="flex-1 border-t border-app pt-1">
                {hourEvents.map((e) => (
                  <button
                    key={e.id + e.source}
                    onClick={() => onEventClick(e)}
                    className="block w-full text-left text-sm px-2 py-1.5 rounded mb-1 hover:opacity-80"
                    style={{ backgroundColor: `${e.color}20`, color: e.color }}
                  >
                    {e.title}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {dayEvents.filter((e) => !e.startTime).length > 0 && (
          <div className="border-t border-app pt-3 mt-2">
            <p className="text-xs text-tertiary mb-2">All-day & undated</p>
            {dayEvents.filter((e) => !e.startTime).map((e) => (
              <button
                key={e.id + e.source}
                onClick={() => onEventClick(e)}
                className="block w-full text-left text-sm px-2 py-1.5 rounded mb-1 hover:opacity-80"
                style={{ backgroundColor: `${e.color}20`, color: e.color }}
              >
                {e.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventModal({ event, subjects, userId, defaultDate, onClose, onSaved }: {
  event: CalendarEvent | null;
  subjects: any[];
  userId: string;
  defaultDate: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const draftKey = `studytrack:calendar-event-draft:${userId}:${event?.id ?? defaultDate ?? 'new'}`;
  const [savedDraft] = useState<Partial<{
    title: string; description: string; eventType: CalendarEvent['event_type'];
    startDate: string; startTime: string; endDate: string; endTime: string;
    allDay: boolean; subjectId: string; location: string;
  }>>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(draftKey) ?? '{}');
    } catch {
      return {};
    }
  });
  const [title, setTitle] = useState(event?.title ?? savedDraft.title ?? '');
  const [description, setDescription] = useState(event?.description ?? savedDraft.description ?? '');
  const [eventType, setEventType] = useState<CalendarEvent['event_type']>(event?.event_type ?? savedDraft.eventType ?? 'personal');
  const [startDate, setStartDate] = useState(
    event ? event.start_date.slice(0, 10) : (savedDraft.startDate ?? defaultDate ?? new Date().toISOString().split('T')[0])
  );
  const [startTime, setStartTime] = useState(event ? new Date(event.start_date).toTimeString().slice(0, 5) : (savedDraft.startTime ?? '09:00'));
  const [endDate, setEndDate] = useState(
    event ? event.end_date.slice(0, 10) : (savedDraft.endDate ?? defaultDate ?? new Date().toISOString().split('T')[0])
  );
  const [endTime, setEndTime] = useState(event ? new Date(event.end_date).toTimeString().slice(0, 5) : (savedDraft.endTime ?? '10:00'));
  const [allDay, setAllDay] = useState(event?.all_day ?? savedDraft.allDay ?? false);
  const [subjectId, setSubjectId] = useState(event?.subject_id ?? savedDraft.subjectId ?? '');
  const [location, setLocation] = useState(event?.location ?? savedDraft.location ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(draftKey, JSON.stringify({
      title, description, eventType, startDate, startTime, endDate, endTime, allDay, subjectId, location,
    }));
  }, [draftKey, title, description, eventType, startDate, startTime, endDate, endTime, allDay, subjectId, location]);

  const closeAndDiscardDraft = () => {
    window.localStorage.removeItem(draftKey);
    onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    const startISO = allDay ? `${startDate}T00:00:00` : `${startDate}T${startTime}:00`;
    const endISO = allDay ? `${endDate}T23:59:59` : `${endDate}T${endTime}:00`;
    const payload = {
      title,
      description: description || null,
      event_type: eventType,
      start_date: startISO,
      end_date: endISO,
      all_day: allDay,
      subject_id: subjectId || null,
      location: location || null,
    };

    if (event) {
      await supabase.from('calendar_events').update(payload).eq('id', event.id);
    } else {
      await supabase.from('calendar_events').insert({ ...payload, user_id: userId });
    }
    window.localStorage.removeItem(draftKey);
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={closeAndDiscardDraft} title={event ? 'Edit event' : 'New event'} size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Biology mock exam" autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Event type</label>
          <select className="input" value={eventType} onChange={(e) => setEventType(e.target.value as CalendarEvent['event_type'])}>
            {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Subject (optional)</label>
          <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">No subject</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="rounded accent-brand-500" />
          <span className="text-sm text-secondary">All-day event</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Start date</label>
            <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          {!allDay && (
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">Start time</label>
              <input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">End date</label>
            <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          {!allDay && (
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">End time</label>
              <input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Location (optional)</label>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Room 12, Science block" />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Description (optional)</label>
          <textarea className="input min-h-[60px]" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving || !title.trim()} className="btn btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : 'Save event'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
