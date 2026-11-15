import { useState, useMemo } from 'react';
import { useUserData } from '@/hooks/useUserData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState, Spinner } from '@/components/ui/Common';
import { formatShortDate } from '@/lib/spacedRepetition';
import type { Note } from '@/lib/supabase';
import {
  StickyNote, Plus, Edit2, Trash2, Search, Pin, BookOpen, Bold,
  List as ListIcon, Heading
} from 'lucide-react';

export function NotesPage() {
  const data = useUserData();
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');

  const filtered = useMemo(() => {
    const sorted = [...data.notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    return sorted.filter((n) => {
      if (filterSubject !== 'all' && n.subject_id !== filterSubject) return false;
      if (search && !n.title.toLowerCase().includes(search.toLowerCase()) && !n.content.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data.notes, search, filterSubject]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('notes').delete().eq('id', deleteId);
    setDeleteId(null);
    data.refresh();
  };

  const togglePin = async (note: Note) => {
    await supabase.from('notes').update({ pinned: !note.pinned }).eq('id', note.id);
    data.refresh();
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Notes</h1>
          <p className="text-secondary text-sm mt-1">Create and organise notes by subject and topic</p>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn btn-primary">
          <Plus size={16} /> New note
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
          <input className="input pl-10" placeholder="Search notes..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-48" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
          <option value="all">All subjects</option>
          {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<StickyNote size={48} />}
            title="No notes yet"
            description="Create your first note to start building your study library."
            action={<button onClick={() => setShowModal(true)} className="btn btn-primary"><Plus size={16} /> New note</button>}
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((note) => (
            <div key={note.id} className="card p-4 group hover:shadow-md transition-shadow flex flex-col" style={{ borderLeftColor: note.subject?.color, borderLeftWidth: note.subject ? 3 : 1 }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {note.pinned && <Pin size={14} className="text-brand-500 shrink-0" />}
                  <h3 className="font-medium text-primary truncate">{note.title}</h3>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => togglePin(note)} className="btn-ghost btn !p-1">
                    <Pin size={14} className={note.pinned ? 'text-brand-500' : ''} />
                  </button>
                  <button onClick={() => { setEditing(note); setShowModal(true); }} className="btn-ghost btn !p-1"><Edit2 size={14} /></button>
                  <button onClick={() => setDeleteId(note.id)} className="btn-ghost btn !p-1 text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
              <p className="text-sm text-secondary line-clamp-4 flex-1 whitespace-pre-wrap">{note.content || 'No content'}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-app">
                {note.subject ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: note.subject.color }} />
                    <span className="text-xs text-tertiary">{note.subject.name}</span>
                  </div>
                ) : <span className="text-xs text-tertiary">No subject</span>}
                <span className="text-xs text-tertiary">{formatShortDate(note.updated_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <NoteModal
          note={editing}
          subjects={data.subjects}
          topics={data.topics}
          userId={user!.id}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); data.refresh(); }}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete note"
        message="Are you sure you want to delete this note?"
        confirmLabel="Delete"
      />
    </div>
  );
}

function NoteModal({ note, subjects, topics, userId, onClose, onSaved }: {
  note: Note | null;
  subjects: any[];
  topics: any[];
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [subjectId, setSubjectId] = useState(note?.subject_id ?? '');
  const [topicId, setTopicId] = useState(note?.topic_id ?? '');
  const [saving, setSaving] = useState(false);

  const subjectTopics = topics.filter((t) => t.subject_id === subjectId);

  const insertFormatting = (prefix: string, suffix: string = prefix) => {
    const textarea = document.getElementById('note-content') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const newContent = content.substring(0, start) + prefix + selected + suffix + content.substring(end);
    setContent(newContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      title,
      content,
      subject_id: subjectId || null,
      topic_id: topicId || null,
      updated_at: new Date().toISOString(),
    };
    if (note) {
      await supabase.from('notes').update(payload).eq('id', note.id);
    } else {
      await supabase.from('notes').insert({ ...payload, user_id: userId });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={note ? 'Edit note' : 'New note'} size="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Subject (optional)</label>
            <select className="input" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); }}>
              <option value="">No subject</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Topic (optional)</label>
            <select className="input" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="">No topic</option>
              {subjectTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-secondary">Content</label>
            <div className="flex gap-1">
              <button onClick={() => insertFormatting('# ', '')} className="btn-ghost btn !p-1.5" title="Heading"><Heading size={14} /></button>
              <button onClick={() => insertFormatting('**')} className="btn-ghost btn !p-1.5" title="Bold"><Bold size={14} /></button>
              <button onClick={() => insertFormatting('- ', '')} className="btn-ghost btn !p-1.5" title="List"><ListIcon size={14} /></button>
            </div>
          </div>
          <textarea
            id="note-content"
            className="input min-h-[240px] font-mono text-sm"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note here... Use # for headings, ** for bold, - for bullet points"
          />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving || !title.trim()} className="btn btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : 'Save note'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
