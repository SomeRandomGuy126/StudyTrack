import { useState, useEffect } from 'react';
import { useUserData } from '@/hooks/useUserData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState, Spinner } from '@/components/ui/Common';
import { EDUCATION_LEVELS, SUBJECT_COLORS } from '@/lib/spacedRepetition';
import type { Subject, Topic } from '@/lib/supabase';
import {
  BookOpen, Plus, ChevronRight, ChevronDown, FolderPlus, Edit2, Trash2,
  Layers, AlertCircle
} from 'lucide-react';

export function SubjectsPage() {
  const data = useUserData();
  const { user } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [showTopicModal, setShowTopicModal] = useState<{ parentId: string | null; editing?: Topic } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'subject' | 'topic'; id: string; name: string } | null>(null);

  // Automatically reveal newly-created subtopics so AI-created items are visible.
  useEffect(() => {
    const parentsWithChildren = data.topics.filter((topic) => topic.parent_id).map((topic) => topic.parent_id as string);
    if (parentsWithChildren.length) {
      setExpandedTopics((previous) => {
        const next = new Set(previous);
        parentsWithChildren.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [data.topics]);

  if (data.loading) {
    return <div className="flex items-center justify-center py-20"><Spinner size={32} className="text-brand-500" /></div>;
  }

  const toggleExpand = (id: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'subject') {
      await supabase.from('subjects').delete().eq('id', deleteTarget.id);
      if (selectedSubject?.id === deleteTarget.id) setSelectedSubject(null);
    } else {
      await supabase.from('topics').delete().eq('id', deleteTarget.id);
    }
    setDeleteTarget(null);
    data.refresh();
  };

  const renderTopicTree = (topics: Topic[], level = 0) => {
    return topics.map((topic) => {
      const hasChildren = topic.children && topic.children.length > 0;
      const expanded = expandedTopics.has(topic.id);
      return (
        <div key={topic.id}>
          <div
            className="flex items-center gap-2 py-2 px-3 rounded-lg hover:surface-tertiary group transition-colors"
            style={{ marginLeft: level * 20 }}
          >
            <button
              onClick={() => hasChildren && toggleExpand(topic.id)}
              className="w-5 h-5 flex items-center justify-center text-tertiary shrink-0"
            >
              {hasChildren ? (expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : null}
            </button>
            <span className="text-sm text-primary flex-1 truncate">{topic.name}</span>
            {topic.teacher_name && <span className="text-xs text-tertiary shrink-0">· {topic.teacher_name}</span>}
            {topic.is_difficult && (
              <AlertCircle size={14} className="text-orange-500 shrink-0" />
            )}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setShowTopicModal({ parentId: topic.id })}
                className="btn-ghost btn !p-1"
                title="Add subtopic"
              >
                <FolderPlus size={14} />
              </button>
              <button
                onClick={() => setShowTopicModal({ parentId: topic.parent_id ?? null, editing: topic })}
                className="btn-ghost btn !p-1"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => setDeleteTarget({ type: 'topic', id: topic.id, name: topic.name })}
                className="btn-ghost btn !p-1 text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          {hasChildren && expanded && renderTopicTree(topic.children!, level + 1)}
        </div>
      );
    });
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Subjects</h1>
          <p className="text-secondary text-sm mt-1">Organise your subjects, topics and subtopics</p>
        </div>
        <button
          onClick={() => { setEditingSubject(null); setShowSubjectModal(true); }}
          className="btn btn-primary"
        >
          <Plus size={16} /> New subject
        </button>
      </div>

      {data.subjects.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<BookOpen size={48} />}
            title="No subjects yet"
            description="Create your first subject to start organising your studies."
            action={
              <button onClick={() => setShowSubjectModal(true)} className="btn btn-primary">
                <Plus size={16} /> Create subject
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Subject list */}
          <div className="space-y-2">
            {data.subjects.map((subject) => {
              const topicCount = data.topics.filter((t) => t.subject_id === subject.id).length;
              const sessionCount = data.studySessions.filter((s) => s.subject_id === subject.id).length;
              return (
                <div
                  key={subject.id}
                  onClick={() => setSelectedSubject(subject)}
                  className={`card p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedSubject?.id === subject.id ? 'ring-2 ring-brand-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${subject.color}20`, color: subject.color }}>
                      <BookOpen size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-primary truncate">{subject.name}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-tertiary">
                        <span>{topicCount} topics</span>
                        <span>·</span>
                        <span>{sessionCount} sessions</span>
                      </div>
                      {subject.exam_board && (
                        <span className="badge mt-2" style={{ backgroundColor: `${subject.color}15`, color: subject.color }}>
                          {subject.exam_board}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingSubject(subject); setShowSubjectModal(true); }}
                        className="btn-ghost btn !p-1"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'subject', id: subject.id, name: subject.name }); }}
                        className="btn-ghost btn !p-1 text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Topic tree */}
          <div className="lg:col-span-2">
            {selectedSubject ? (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${selectedSubject.color}20`, color: selectedSubject.color }}>
                      <Layers size={18} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-primary">{selectedSubject.name}</h3>
                      {selectedSubject.qualification_level && (
                        <p className="text-xs text-tertiary">{selectedSubject.qualification_level}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTopicModal({ parentId: null })}
                    className="btn btn-secondary text-sm"
                  >
                    <Plus size={14} /> Add topic
                  </button>
                </div>

                <div className="border-t border-app pt-3">
                  {data.getTopicTree(selectedSubject.id).length === 0 ? (
                    <EmptyState
                      icon={<FolderPlus size={36} />}
                      title="No topics yet"
                      description="Add your first topic to start building your subject structure."
                      action={
                        <button onClick={() => setShowTopicModal({ parentId: null })} className="btn btn-secondary text-sm">
                          <Plus size={14} /> Add topic
                        </button>
                      }
                    />
                  ) : (
                    renderTopicTree(data.getTopicTree(selectedSubject.id))
                  )}
                </div>
              </div>
            ) : (
              <div className="card">
                <EmptyState
                  icon={<Layers size={48} />}
                  title="Select a subject"
                  description="Choose a subject from the left to view and manage its topics."
                />
              </div>
            )}
          </div>
        </div>
      )}

      {showSubjectModal && (
        <SubjectModal
          subject={editingSubject}
          onClose={() => setShowSubjectModal(false)}
          userId={user!.id}
          position={data.subjects.length}
          onSaved={() => { setShowSubjectModal(false); data.refresh(); }}
        />
      )}

      {showTopicModal && selectedSubject && (
        <TopicModal
          topic={showTopicModal.editing ?? null}
          subjectId={selectedSubject.id}
          teachers={selectedSubject.teachers ?? []}
          parentId={showTopicModal.parentId}
          position={showTopicModal.editing ? showTopicModal.editing.position : (data.topics.filter(t => t.parent_id === showTopicModal.parentId && t.subject_id === selectedSubject.id).length)}
          teacherNames={selectedSubject.teacher_names ?? []}
          onClose={() => setShowTopicModal(null)}
          onSaved={() => { setShowTopicModal(null); data.refresh(); }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete ${deleteTarget?.type ?? ''}`}
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will also delete all related data.`}
        confirmLabel="Delete"
      />
    </div>
  );
}

function SubjectModal({ subject, onClose, userId, position, onSaved }: {
  subject: Subject | null;
  onClose: () => void;
  userId: string;
  position: number;
  onSaved: () => void;
}) {
  const [name, setName] = useState(subject?.name ?? '');
  const [color, setColor] = useState(subject?.color ?? SUBJECT_COLORS[0]);
  const [examBoard, setExamBoard] = useState(subject?.exam_board ?? '');
  const [qualificationLevel, setQualificationLevel] = useState(subject?.qualification_level ?? '');
  const [teacherNames, setTeacherNames] = useState((subject?.teacher_names ?? []).join(', '));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    if (subject) {
      await supabase.from('subjects').update({
        name, color, exam_board: examBoard || null, qualification_level: qualificationLevel || null,
        teacher_names: teacherNames.split(',').map((v) => v.trim()).filter(Boolean),
      }).eq('id', subject.id);
    } else {
      await supabase.from('subjects').insert({
        user_id: userId, name, color, exam_board: examBoard || null,
        qualification_level: qualificationLevel || null, teacher_names: teacherNames.split(',').map((v) => v.trim()).filter(Boolean), position,
      });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={subject ? 'Edit subject' : 'New subject'}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Subject name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Biology" autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-2">Colour</label>
          <div className="flex flex-wrap gap-2">
            {SUBJECT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-lg transition-all ${color === c ? 'ring-2 ring-offset-2 ring-brand-500 scale-110' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Exam board</label>
            <input className="input" value={examBoard} onChange={(e) => setExamBoard(e.target.value)} placeholder="e.g. AQA" />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Qualification</label>
            <select className="input" value={qualificationLevel} onChange={(e) => setQualificationLevel(e.target.value)}>
              <option value="">Select qualification...</option>
              {qualificationLevel && !EDUCATION_LEVELS.includes(qualificationLevel) && (
                <option value={qualificationLevel}>{qualificationLevel}</option>
              )}
              {EDUCATION_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Teachers (optional)</label>
          <input className="input" value={teacherNames} onChange={(e) => setTeacherNames(e.target.value)} placeholder="e.g. Mrs Smith, Mr Jones" />
          <p className="text-xs text-tertiary mt-1">Separate multiple teachers with commas.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Teachers (optional)</label>
          <textarea className="input min-h-[72px]" value={teachersText} onChange={(e) => setTeachersText(e.target.value)} placeholder="Add teacher names, separated by commas" />
          <p className="text-xs text-tertiary mt-1">You can add more than one teacher.</p>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="btn btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TopicModal({ topic, subjectId, teachers, parentId, position, onClose, onSaved }: {
  topic: Topic | null;
  subjectId: string;
  teachers: string[];
  parentId: string | null;
  position: number;
  teacherNames: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(topic?.name ?? '');
  const [description, setDescription] = useState(topic?.description ?? '');
  const [isDifficult, setIsDifficult] = useState(topic?.is_difficult ?? false);
  const [teacherName, setTeacherName] = useState(topic?.teacher_name ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    if (topic) {
      await supabase.from('topics').update({ name, description: description || null, is_difficult: isDifficult, teacher_name: teacherName || null }).eq('id', topic.id);
    } else {
      await supabase.from('topics').insert({
        subject_id: subjectId, parent_id: parentId, name,
        description: description || null, is_difficult: isDifficult, teacher_name: teacherName || null, position,
      });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={topic ? 'Edit topic' : 'New topic'} size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Topic name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cell structure" autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Description (optional)</label>
          <textarea className="input min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of what this topic covers" />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Teacher (optional)</label>
          {teacherNames.length > 0 ? (
            <select className="input" value={teacherName} onChange={(e) => setTeacherName(e.target.value)}>
              <option value="">No teacher selected</option>
              {teacherNames.map((teacher) => <option key={teacher} value={teacher}>{teacher}</option>)}
            </select>
          ) : (
            <input className="input" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="Enter teacher name (optional)" />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Teacher (optional)</label>
          <select className="input" value={teacherName} onChange={(e) => setTeacherName(e.target.value)}>
            <option value="">Not specified</option>
            {teachers.map((teacher) => <option key={teacher} value={teacher}>{teacher}</option>)}
          </select>
          {teachers.length === 0 && <p className="text-xs text-tertiary mt-1">Add teachers to this subject first to select one here.</p>}
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isDifficult} onChange={(e) => setIsDifficult(e.target.checked)} className="rounded accent-brand-500" />
          <span className="text-sm text-secondary">Mark as difficult (revision will be scheduled sooner)</span>
        </label>
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="btn btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
