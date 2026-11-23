import { useState, useMemo } from 'react';
import { useUserData } from '@/hooks/useUserData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState, Spinner, Badge, ProgressBar } from '@/components/ui/Common';
import { TASK_STATUSES, PRIORITY_LEVELS, relativeDate, daysUntil, toLocalDateString } from '@/lib/spacedRepetition';
import type { Task, Subtask } from '@/lib/supabase';
import {
  CheckSquare, Plus, List, Columns3, Calendar as CalIcon, Table as TableIcon,
  Edit2, Trash2, Check, Circle, Dot, FolderPlus, Search, Flag, CheckCircle2
} from 'lucide-react';

type View = 'list' | 'kanban' | 'calendar' | 'table';

export function TasksPage() {
  const data = useUserData();
  const { user } = useAuth();
  const [view, setView] = useState<View>('list');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  const filtered = useMemo(() => {
    return data.tasks.filter((t) => {
      if (filterProject !== 'all' && t.project_id !== filterProject) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data.tasks, search, filterProject, filterStatus, filterPriority]);

  if (data.loading) {
    return <div className="flex items-center justify-center py-20"><Spinner size={32} className="text-brand-500" /></div>;
  }

  const handleStatusChange = async (taskId: string, status: Task['status']) => {
    await supabase.from('tasks').update({
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    }).eq('id', taskId);
    data.refresh();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('tasks').delete().eq('id', deleteId);
    setDeleteId(null);
    data.refresh();
  };

  const views = [
    { id: 'list' as View, label: 'List', icon: List },
    { id: 'kanban' as View, label: 'Board', icon: Columns3 },
    { id: 'calendar' as View, label: 'Calendar', icon: CalIcon },
    { id: 'table' as View, label: 'Table', icon: TableIcon },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Tasks</h1>
          <p className="text-secondary text-sm mt-1">Manage your assignments, projects and deadlines</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowProjectModal(true)} className="btn btn-secondary">
            <FolderPlus size={16} /> New project
          </button>
          <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn btn-primary">
            <Plus size={16} /> New task
          </button>
        </div>
      </div>

      {/* Project filters */}
      {data.projects.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterProject('all')}
            className={`btn !py-1.5 text-sm whitespace-nowrap ${filterProject === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          >
            All projects
          </button>
          {data.projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setFilterProject(p.id)}
              className={`btn !py-1.5 text-sm whitespace-nowrap ${filterProject === p.id ? 'btn-primary' : 'btn-secondary'}`}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
          <input className="input pl-10" placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-36" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All status</option>
          {TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="input sm:w-36" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
          <option value="all">All priority</option>
          {PRIORITY_LEVELS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
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
            icon={<CheckSquare size={48} />}
            title="No tasks yet"
            description="Create tasks to track your assignments, homework and projects."
            action={<button onClick={() => setShowModal(true)} className="btn btn-primary"><Plus size={16} /> New task</button>}
          />
        </div>
      ) : view === 'list' ? (
        <ListView tasks={filtered} onEdit={(t) => { setEditing(t); setShowModal(true); }} onDelete={(id) => setDeleteId(id)} onStatusChange={handleStatusChange} />
      ) : view === 'kanban' ? (
        <KanbanView tasks={filtered} onEdit={(t) => { setEditing(t); setShowModal(true); }} onStatusChange={handleStatusChange} />
      ) : view === 'calendar' ? (
        <TaskCalendarView tasks={filtered} onEdit={(t) => { setEditing(t); setShowModal(true); }} />
      ) : (
        <TableView tasks={filtered} onEdit={(t) => { setEditing(t); setShowModal(true); }} onDelete={(id) => setDeleteId(id)} onStatusChange={handleStatusChange} />
      )}

      {showModal && (
        <TaskModal
          task={editing}
          subjects={data.subjects}
          projects={data.projects}
          userId={user!.id}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); data.refresh(); }}
        />
      )}

      {showProjectModal && (
        <ProjectModal
          userId={user!.id}
          position={data.projects.length}
          onClose={() => setShowProjectModal(false)}
          onSaved={() => { setShowProjectModal(false); data.refresh(); }}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete task"
        message="Are you sure you want to delete this task?"
        confirmLabel="Delete"
      />
    </div>
  );
}

function PriorityBadge({ priority }: { priority: Task['priority'] }) {
  const p = PRIORITY_LEVELS.find((p) => p.value === priority);
  if (!p) return null;
  return <Badge color={p.color}><Flag size={10} className="mr-1" />{p.label}</Badge>;
}

function StatusBadge({ status }: { status: Task['status'] }) {
  const s = TASK_STATUSES.find((s) => s.value === status);
  if (!s) return null;
  return <Badge color={s.color}>{s.label}</Badge>;
}

function ListView({ tasks, onEdit, onDelete, onStatusChange }: {
  tasks: Task[];
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, s: Task['status']) => void;
}) {
  const sorted = [...tasks].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    return 0;
  });

  return (
    <div className="space-y-2">
      {sorted.map((t) => {
        const isOverdue = t.deadline && t.status !== 'completed' && daysUntil(t.deadline) < 0;
        const subtaskDone = t.subtasks?.filter((s) => s.completed).length ?? 0;
        return (
          <div key={t.id} className="card p-4 group hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              <button
                onClick={() => onStatusChange(t.id, t.status === 'completed' ? 'todo' : 'completed')}
                className="mt-0.5 shrink-0"
              >
                {t.status === 'completed' ? (
                  <CheckCircle2 size={20} className="text-green-500" />
                ) : (
                  <Circle size={20} className="text-tertiary hover:text-brand-500" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`font-medium truncate ${t.status === 'completed' ? 'line-through text-tertiary' : 'text-primary'}`}>
                    {t.title}
                  </p>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(t)} className="btn-ghost btn !p-1"><Edit2 size={14} /></button>
                    <button onClick={() => onDelete(t.id)} className="btn-ghost btn !p-1 text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>
                {t.description && <p className="text-sm text-secondary mt-1 line-clamp-2">{t.description}</p>}
                <div className="flex items-center flex-wrap gap-2 mt-2">
                  <StatusBadge status={t.status} />
                  <PriorityBadge priority={t.priority} />
                  {t.deadline && (
                    <Badge color={isOverdue ? '#ef4444' : '#64748b'}>
                      <CalIcon size={10} className="mr-1" />{relativeDate(t.deadline)}
                    </Badge>
                  )}
                  {t.subject && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.subject.color }} />
                      <span className="text-xs text-tertiary">{t.subject.name}</span>
                    </div>
                  )}
                  {t.tags.length > 0 && t.tags.map((tag) => (
                    <span key={tag} className="text-xs text-tertiary">#{tag}</span>
                  ))}
                  {t.subtasks && t.subtasks.length > 0 && (
                    <span className="text-xs text-tertiary">{subtaskDone}/{t.subtasks.length} subtasks</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanView({ tasks, onEdit, onStatusChange }: {
  tasks: Task[];
  onEdit: (t: Task) => void;
  onStatusChange: (id: string, s: Task['status']) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {TASK_STATUSES.map((status) => {
        const colTasks = tasks.filter((t) => t.status === status.value);
        return (
          <div key={status.value} className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                <span className="font-medium text-primary text-sm">{status.label}</span>
              </div>
              <span className="text-xs text-tertiary">{colTasks.length}</span>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {colTasks.map((t) => {
                const isOverdue = t.deadline && t.status !== 'completed' && daysUntil(t.deadline) < 0;
                const subtaskDone = t.subtasks?.filter((s) => s.completed).length ?? 0;
                return (
                  <div key={t.id} onClick={() => onEdit(t)} className="card p-3 cursor-pointer hover:shadow-md transition-shadow">
                    <p className="text-sm font-medium text-primary mb-2">{t.title}</p>
                    {t.description && <p className="text-xs text-secondary mb-2 line-clamp-2">{t.description}</p>}
                    <div className="flex items-center flex-wrap gap-1.5 mb-2">
                      <PriorityBadge priority={t.priority} />
                      {t.deadline && (
                        <Badge color={isOverdue ? '#ef4444' : '#64748b'}>
                          <CalIcon size={10} className="mr-1" />{relativeDate(t.deadline)}
                        </Badge>
                      )}
                    </div>
                    {t.subtasks && t.subtasks.length > 0 && (
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-tertiary mb-1">
                          <span>Subtasks</span><span>{subtaskDone}/{t.subtasks.length}</span>
                        </div>
                        <ProgressBar value={subtaskDone} max={t.subtasks.length} color={status.color} />
                      </div>
                    )}
                    {t.subject && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.subject.color }} />
                        <span className="text-xs text-tertiary">{t.subject.name}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {colTasks.length === 0 && <p className="text-xs text-tertiary text-center py-4">No tasks</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TableView({ tasks, onEdit, onDelete, onStatusChange }: {
  tasks: Task[];
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, s: Task['status']) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="surface-tertiary">
            <tr>
              <th className="p-3 w-8"></th>
              <th className="text-left p-3 font-medium text-secondary">Title</th>
              <th className="text-left p-3 font-medium text-secondary">Status</th>
              <th className="text-left p-3 font-medium text-secondary">Priority</th>
              <th className="text-left p-3 font-medium text-secondary">Deadline</th>
              <th className="text-left p-3 font-medium text-secondary">Project</th>
              <th className="text-left p-3 font-medium text-secondary">Subject</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-t border-app hover:surface-tertiary group">
                <td className="p-3">
                  <button onClick={() => onStatusChange(t.id, t.status === 'completed' ? 'todo' : 'completed')}>
                    {t.status === 'completed' ? <CheckCircle2 size={16} className="text-green-500" /> : <Circle size={16} className="text-tertiary" />}
                  </button>
                </td>
                <td className="p-3 text-primary font-medium cursor-pointer" onClick={() => onEdit(t)}>{t.title}</td>
                <td className="p-3"><StatusBadge status={t.status} /></td>
                <td className="p-3"><PriorityBadge priority={t.priority} /></td>
                <td className="p-3 text-secondary whitespace-nowrap">{t.deadline ? relativeDate(t.deadline) : '—'}</td>
                <td className="p-3 text-secondary">{t.project?.name ?? '—'}</td>
                <td className="p-3">
                  {t.subject && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.subject.color }} />
                      <span className="text-secondary">{t.subject.name}</span>
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button onClick={() => onEdit(t)} className="btn-ghost btn !p-1"><Edit2 size={14} /></button>
                    <button onClick={() => onDelete(t.id)} className="btn-ghost btn !p-1 text-red-500"><Trash2 size={14} /></button>
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

function TaskCalendarView({ tasks, onEdit }: { tasks: Task[]; onEdit: (t: Task) => void }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startDay = monthStart.getDay() || 7;
  const days: (Date | null)[] = [];
  for (let i = 1; i < startDay; i++) days.push(null);
  for (let d = 1; d <= monthEnd.getDate(); d++) days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d));

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach((t) => {
      if (t.deadline) {
        if (!map[t.deadline]) map[t.deadline] = [];
        map[t.deadline].push(t);
      }
    });
    return map;
  }, [tasks]);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-primary">{currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3>
        <div className="flex gap-1">
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="btn btn-secondary !p-2">‹</button>
          <button onClick={() => setCurrentMonth(new Date())} className="btn btn-secondary text-sm">Today</button>
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="btn btn-secondary !p-2">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="text-center text-xs font-medium text-tertiary py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = toLocalDateString(day);
          const dayTasks = tasksByDate[dateStr] ?? [];
          const isToday = new Date().toDateString() === day.toDateString();
          return (
            <div key={i} className={`min-h-[70px] p-1.5 rounded-lg surface-tertiary ${isToday ? 'ring-1 ring-brand-500' : ''}`}>
              <p className={`text-xs ${isToday ? 'text-brand-600 font-bold' : 'text-secondary'}`}>{day.getDate()}</p>
              <div className="space-y-0.5 mt-1">
                {dayTasks.slice(0, 3).map((t) => {
                  const p = PRIORITY_LEVELS.find((p) => p.value === t.priority);
                  return (
                    <button key={t.id} onClick={() => onEdit(t)} className="block w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate hover:opacity-80" style={{ backgroundColor: `${p?.color}25`, color: p?.color }}>
                      {t.title}
                    </button>
                  );
                })}
                {dayTasks.length > 3 && <p className="text-[10px] text-tertiary px-1">+{dayTasks.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskModal({ task, subjects, projects, userId, onClose, onSaved }: {
  task: Task | null;
  subjects: any[];
  projects: any[];
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<Task['status']>(task?.status ?? 'todo');
  const [priority, setPriority] = useState<Task['priority']>(task?.priority ?? 'medium');
  const [deadline, setDeadline] = useState(task?.deadline ?? '');
  const [projectId, setProjectId] = useState(task?.project_id ?? '');
  const [subjectId, setSubjectId] = useState(task?.subject_id ?? '');
  const [tags, setTags] = useState(task?.tags?.join(', ') ?? '');
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks ?? []);
  const [newSubtask, setNewSubtask] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      title,
      description: description || null,
      status,
      priority,
      deadline: deadline || null,
      project_id: projectId || null,
      subject_id: subjectId || null,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    };

    let taskId = task?.id;
    if (task) {
      await supabase.from('tasks').update({ ...payload, completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', task.id);
    } else {
      const { data: newTask } = await supabase.from('tasks').insert({ ...payload, user_id: userId }).select().single();
      taskId = newTask?.id;
    }

    if (taskId) {
      if (task) await supabase.from('subtasks').delete().eq('task_id', taskId);
      if (subtasks.length > 0) {
        await supabase.from('subtasks').insert(
          subtasks.map((s, i) => ({ task_id: taskId, title: s.title, completed: s.completed, position: i }))
        );
      }
    }

    setSaving(false);
    onSaved();
  };

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    setSubtasks([...subtasks, { id: '', task_id: '', title: newSubtask, completed: false, position: subtasks.length, created_at: '' }]);
    setNewSubtask('');
  };

  return (
    <Modal open onClose={onClose} title={task ? 'Edit task' : 'New task'} size="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Complete Biology past paper" autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Description</label>
          <textarea className="input min-h-[60px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Task details..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as Task['status'])}>
              {TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Priority</label>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as Task['priority'])}>
              {PRIORITY_LEVELS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Deadline</label>
            <input type="date" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Project</label>
            <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">No project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Subject</label>
          <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">No subject</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Tags (comma-separated)</label>
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. revision, urgent, exam" />
        </div>
        {/* Subtasks */}
        <div>
          <label className="block text-sm font-medium text-secondary mb-2">Subtasks</label>
          <div className="space-y-1.5 mb-2">
            {subtasks.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  onClick={() => setSubtasks(subtasks.map((st, idx) => idx === i ? { ...st, completed: !st.completed } : st))}
                  className="shrink-0"
                >
                  {s.completed ? <CheckCircle2 size={16} className="text-green-500" /> : <Circle size={16} className="text-tertiary" />}
                </button>
                <span className={`text-sm flex-1 ${s.completed ? 'line-through text-tertiary' : 'text-primary'}`}>{s.title}</span>
                <button onClick={() => setSubtasks(subtasks.filter((_, idx) => idx !== i))} className="btn-ghost btn !p-1 text-red-500">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="input" value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtask())} placeholder="Add a subtask..." />
            <button onClick={addSubtask} className="btn btn-secondary"><Plus size={16} /></button>
          </div>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving || !title.trim()} className="btn btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : 'Save task'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ProjectModal({ userId, position, onClose, onSaved }: {
  userId: string;
  position: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('projects').insert({
      user_id: userId, name, description: description || null, color, position,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title="New project" size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Project name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Biology revision" autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Description (optional)</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-2">Colour</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-10 rounded-lg" />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="btn btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : 'Create'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
