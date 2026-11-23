import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useUserData } from '@/hooks/useUserData';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Common';
import {
  generateFlashcards, extractMaterial, tutorTurn, summarizeYoutube,
  generateNotes, generateQuiz, AiError,
  type AiCard, type QuizQuestion,
} from '@/lib/aiClient';
import type { Note, Subject, Topic } from '@/lib/supabase';
import {
  Wand2, Layers, GraduationCap, FileText, Youtube, Sparkles, Plus, Trash2,
  Save, Edit2, Send, X, CheckCircle2, Bot, User, RotateCcw, BookOpen,
  ListChecks,
} from 'lucide-react';

type Tool = 'import' | 'flashcards' | 'tutor' | 'youtube' | 'notes' | 'quiz';

const TOOLS: { id: Tool; title: string; description: string; icon: typeof Wand2; accent: string }[] = [
  { id: 'import', title: 'Magic Import', description: 'Turn notes, documents or pasted text into flashcards, notes and summaries.', icon: Wand2, accent: '#8b5cf6' },
  { id: 'flashcards', title: 'AI Flashcard Generator', description: 'Generate question-and-answer cards from any material, organised by subject and topic.', icon: Layers, accent: '#0ea5e9' },
  { id: 'tutor', title: 'AI Interactive Tutor', description: 'A step-by-step tutor that explains concepts, checks your understanding and adapts to you.', icon: GraduationCap, accent: '#22c55e' },
  { id: 'notes', title: 'AI Notes Generator', description: 'Detailed, simplified, exam-ready or step-by-step notes from your material.', icon: FileText, accent: '#f59e0b' },
  { id: 'quiz', title: 'AI Quiz Generator', description: 'Multiple choice, short answer and true-or-false quizzes with auto-marking.', icon: ListChecks, accent: '#ef4444' },
  { id: 'youtube', title: 'YouTube Summariser', description: 'Paste a video link to get a summary, key points and study notes from the transcript.', icon: Youtube, accent: '#f43f5e' },
];

const COMING_SOON: { title: string; description: string; icon: typeof Wand2 }[] = [
  { title: 'AI Research Assistant', description: 'Search the web, compare sources and save findings with citations.', icon: Sparkles },
  { title: 'PDF, PowerPoint & Word import', description: 'Direct file parsing for documents and handwritten-note images.', icon: BookOpen },
];

export function LearningCentrePage() {
  const data = useUserData();
  const { user } = useAuth();
  const [activeTool, setActiveTool] = useState<Tool | null>(null);

  if (data.loading) {
    return <div className="flex items-center justify-center py-20"><Spinner size={32} className="text-brand-500" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">AI Learning Centre</h1>
        <p className="text-secondary text-sm mt-1">
          Everything you generate here connects to your subjects, topics and revision plan.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            className="card p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: tool.accent }}>
                <tool.icon size={22} />
              </div>
              <div>
                <h3 className="font-semibold text-primary group-hover:text-brand-600 transition-colors">{tool.title}</h3>
                <p className="text-sm text-secondary mt-1">{tool.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wide mb-3">Coming soon</h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {COMING_SOON.map((tool) => (
          <div key={tool.title} className="card p-4 opacity-60">
            <div className="flex items-center gap-2 mb-1.5">
              <tool.icon size={16} className="text-tertiary" />
              <h3 className="font-medium text-secondary text-sm">{tool.title}</h3>
            </div>
            <p className="text-xs text-tertiary">{tool.description}</p>
          </div>
        ))}
      </div>

      {activeTool === 'import' && user && (
        <MagicImportModal user={user.id} data={data} onClose={() => setActiveTool(null)} />
      )}
      {activeTool === 'flashcards' && user && (
        <FlashcardGeneratorModal user={user.id} data={data} onClose={() => setActiveTool(null)} />
      )}
      {activeTool === 'tutor' && user && (
        <TutorWorkspace data={data} onClose={() => setActiveTool(null)} />
      )}
      {activeTool === 'notes' && user && (
        <NotesGeneratorModal user={user.id} data={data} onClose={() => setActiveTool(null)} />
      )}
      {activeTool === 'quiz' && user && (
        <QuizModal user={user.id} data={data} onClose={() => setActiveTool(null)} />
      )}
      {activeTool === 'youtube' && user && (
        <YoutubeModal data={data} onClose={() => setActiveTool(null)} />
      )}
    </div>
  );
}

type DataProp = ReturnType<typeof useUserData>;

function SubjectTopicPicker({ data, subjectId, setSubjectId, topicId, setTopicId, label }: {
  data: DataProp; subjectId: string; setSubjectId: (v: string) => void;
  topicId: string; setTopicId: (v: string) => void; label: string;
}) {
  const subjectTopics = data.topics.filter((t: Topic) => t.subject_id === subjectId);
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-sm font-medium text-secondary mb-1.5">Subject</label>
        <select className="input" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); }}>
          <option value="">No subject</option>
          {data.subjects.map((s: Subject) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary mb-1.5">Topic ({label})</label>
        <select className="input" value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!subjectId}>
          <option value="">No topic</option>
          {subjectTopics.map((t: Topic) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
    </div>
  );
}

async function logAiContent(userId: string, kind: string, title: string, content: unknown, subjectId: string, topicId: string, sourceType: string, sourceUrl?: string | null) {
  await supabase.from('ai_content').insert({
    user_id: userId, kind, title, content, subject_id: subjectId || null,
    topic_id: topicId || null, source_type: sourceType, source_url: sourceUrl ?? null,
  });
}

function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="rounded-lg p-3 text-sm text-red-600 dark:text-red-400" style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}>
      {message}
    </div>
  );
}

/* ---------------- Magic Import ---------------- */

function MagicImportModal({ user, data, onClose }: { user: string; data: DataProp; onClose: () => void }) {
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [pasted, setPasted] = useState('');
  const [fileName, setFileName] = useState('');
  const [material, setMaterial] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<{ title: string; content: string } | null>(null);
  const [error, setError] = useState('');

  const readFile = async (file: File) => {
    setError('');
    setFileName(file.name);
    const isTextLike = file.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(file.name);
    try {
      if (isTextLike) {
        setMaterial(await file.text());
        setPasted('');
      } else {
        setError(`"${file.name}" is not a plain text file. Direct PDF, PowerPoint, Word and image parsing is coming soon — paste the text from the document below and it will work the same way.`);
        setFileName('');
      }
    } catch {
      setError('That file could not be read. Try pasting its text instead.');
      setFileName('');
    }
  };

  const extract = async () => {
    const source = material.trim() || pasted.trim();
    if (!source) return;
    setExtracting(true);
    setError('');
    try {
      const subject = data.subjects.find((s: Subject) => s.id === subjectId)?.name;
      const topic = data.topics.find((t: Topic) => t.id === topicId)?.name;
      const result = await extractMaterial({ material: source, sourceType: 'text', subject, topic });
      setExtracted(result);
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Extraction failed. Please try again.');
    } finally {
      setExtracting(false);
    }
  };

  const importInto = async (kind: 'flashcards' | 'notes' | 'summary') => {
    if (!extracted) return;
    const subject = data.subjects.find((s: Subject) => s.id === subjectId)?.name;
    const topic = data.topics.find((t: Topic) => t.id === topicId)?.name;
    if (kind === 'flashcards') {
      const cards = await generateFlashcards({ material: extracted.content, subject, topic, count: 10 });
      await supabase.from('flashcards').insert(
        cards.map((c) => ({ user_id: user, front: c.front, back: c.back, subject_id: subjectId || null, topic_id: topicId || null, confidence: 3 }))
      );
      await logAiContent(user, 'notes', extracted.title || 'Imported flashcards', { cards }, subjectId, topicId, 'text');
    } else if (kind === 'notes') {
      await supabase.from('notes').insert({
        user_id: user, title: extracted.title || 'Imported notes', content: extracted.content,
        subject_id: subjectId || null, topic_id: topicId || null, color: '#8b5cf6',
      });
      await logAiContent(user, 'notes', extracted.title || 'Imported notes', { content: extracted.content }, subjectId, topicId, 'text');
    } else {
      await logAiContent(user, 'summary', extracted.title || 'Imported summary', extracted, subjectId, topicId, 'text');
    }
    data.refresh();
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Magic Import" size="xl">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Upload a text file</label>
          <input
            type="file" accept=".txt,.md,.csv,text/plain"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }}
            className="input file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:bg-brand-500 file:text-white file:cursor-pointer"
          />
          {fileName && <p className="text-xs text-tertiary mt-1">{fileName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Paste your notes or material</label>
          <textarea
            className="input min-h-[120px]" value={pasted}
            onChange={(e) => { setPasted(e.target.value); setMaterial(''); }}
            placeholder="Paste typed notes, textbook extracts, handwritten-note transcripts, or anything you want to learn from..."
          />
        </div>

        <SubjectTopicPicker data={data} subjectId={subjectId} setSubjectId={setSubjectId} topicId={topicId} setTopicId={setTopicId} label="saves everything under" />

        <button onClick={extract} disabled={extracting || (!material.trim() && !pasted.trim())} className="btn btn-primary w-full disabled:opacity-50">
          {extracting ? <><RotateCcw size={16} className="animate-spin" /> Extracting content...</> : <><Sparkles size={16} /> Extract content</>}
        </button>

        <ErrorNote message={error} />

        {extracted && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">Extracted title (editable)</label>
              <input className="input" value={extracted.title} onChange={(e) => setExtracted({ ...extracted, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">Extracted content (editable)</label>
              <textarea className="input min-h-[160px]" value={extracted.content} onChange={(e) => setExtracted({ ...extracted, content: e.target.value })} />
            </div>
            <div>
              <p className="text-sm font-medium text-secondary mb-2">Now generate:</p>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => importInto('flashcards')} className="btn btn-secondary"><Layers size={16} /> Flashcards</button>
                <button onClick={() => importInto('notes')} className="btn btn-secondary"><FileText size={16} /> Notes</button>
                <button onClick={() => importInto('summary')} className="btn btn-secondary"><BookOpen size={16} /> Summary</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- AI Flashcard Generator ---------------- */

function FlashcardGeneratorModal({ user, data, onClose }: { user: string; data: DataProp; onClose: () => void }) {
  const [source, setSource] = useState<'material' | 'topic'>('material');
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [topicPrompt, setTopicPrompt] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [style, setStyle] = useState('mixed');
  const [count, setCount] = useState(8);
  const [cards, setCards] = useState<AiCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');

  const CARD_STYLES = [
    { id: 'mixed', label: 'Mixed' },
    { id: 'definitions', label: 'Definitions' },
    { id: 'questions', label: 'Questions' },
    { id: 'terminology', label: 'Terminology' },
  ];

  const material = useMemo(() => {
    if (source === 'topic') return `Create flashcards about: ${topicPrompt}`;
    return data.notes.find((n: Note) => n.id === selectedNoteId)?.content ?? '';
  }, [source, topicPrompt, selectedNoteId, data.notes]);

  const generate = async () => {
    setLoading(true); setError(''); setCards([]); setSaved(false);
    try {
      const subject = data.subjects.find((s: Subject) => s.id === subjectId)?.name;
      const topic = data.topics.find((t: Topic) => t.id === topicId)?.name;
      const result = await generateFlashcards({
        material: material.slice(0, 12000), subject,
        topic: topic || (source === 'topic' ? topicPrompt : undefined), count, style,
      });
      setCards(result);
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    await supabase.from('flashcards').insert(
      cards.map((c) => ({ user_id: user, front: c.front, back: c.back, subject_id: subjectId || null, topic_id: topicId || null, confidence: 3 }))
    );
    setSaving(false); setSaved(true); data.refresh();
  };

  const removeCard = (i: number) => setCards(cards.filter((_, idx) => idx !== i));

  const startEdit = (i: number) => {
    setEditingIdx(i); setEditFront(cards[i].front); setEditBack(cards[i].back);
  };

  const commitEdit = () => {
    if (editingIdx === null) return;
    const next = [...cards];
    next[editingIdx] = { front: editFront, back: editBack };
    setCards(next); setEditingIdx(null);
  };

  return (
    <Modal open onClose={onClose} title="AI Flashcard Generator" size="xl">
      <div className="space-y-4">
        <div className="flex gap-2">
          <button onClick={() => setSource('material')} className={`btn ${source === 'material' ? 'btn-primary' : 'btn-secondary'}`}>From my notes</button>
          <button onClick={() => setSource('topic')} className={`btn ${source === 'topic' ? 'btn-primary' : 'btn-secondary'}`}>From a topic</button>
        </div>

        {source === 'material' ? (
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Source note</label>
            <select className="input" value={selectedNoteId} onChange={(e) => setSelectedNoteId(e.target.value)}>
              <option value="">Select a note...</option>
              {data.notes.map((n: Note) => <option key={n.id} value={n.id}>{n.title}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">What should the cards cover?</label>
            <input className="input" value={topicPrompt} onChange={(e) => setTopicPrompt(e.target.value)} placeholder="e.g. The causes of World War One" />
          </div>
        )}

        <SubjectTopicPicker data={data} subjectId={subjectId} setSubjectId={setSubjectId} topicId={topicId} setTopicId={setTopicId} label="cards connect to" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Card style</label>
            <select className="input" value={style} onChange={(e) => setStyle(e.target.value)}>
              {CARD_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Number of cards: {count}</label>
            <input type="range" min={4} max={16} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full mt-2" />
          </div>
        </div>

        <button onClick={generate} disabled={loading || (source === 'material' ? !selectedNoteId : !topicPrompt.trim())} className="btn btn-primary w-full disabled:opacity-50">
          {loading ? <><RotateCcw size={16} className="animate-spin" /> Generating...</> : <><Sparkles size={16} /> Generate with AI</>}
        </button>

        <ErrorNote message={error} />

        {cards.length > 0 && (
          <div className="space-y-2">
            {cards.map((c, i) => (
              <div key={i} className="surface-tertiary rounded-lg p-3 group">
                {editingIdx === i ? (
                  <div className="space-y-2">
                    <input className="input" value={editFront} onChange={(e) => setEditFront(e.target.value)} />
                    <textarea className="input min-h-[60px]" value={editBack} onChange={(e) => setEditBack(e.target.value)} />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingIdx(null)} className="btn btn-secondary !py-1 !px-3 text-xs">Cancel</button>
                      <button onClick={commitEdit} className="btn btn-primary !py-1 !px-3 text-xs"><Save size={12} /> Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-primary">{c.front}</p>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => startEdit(i)} className="btn-ghost btn !p-1"><Edit2 size={13} /></button>
                        <button onClick={() => removeCard(i)} className="btn-ghost btn !p-1 text-red-500"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <p className="text-xs text-secondary mt-1">{c.back}</p>
                  </>
                )}
              </div>
            ))}
            {!saved ? (
              <button onClick={save} disabled={saving} className="btn btn-primary w-full disabled:opacity-50">
                {saving ? 'Saving...' : <><Plus size={16} /> Save {cards.length} cards to my deck</>}
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 text-sm text-green-600 py-2">
                <CheckCircle2 size={16} /> Cards saved — find them on your Flashcards page, connected to your subject.
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- AI Notes Generator ---------------- */

const NOTE_STYLES = [
  { id: 'detailed', label: 'Detailed notes' },
  { id: 'simplified', label: 'Simplified notes' },
  { id: 'exam', label: 'Exam-ready notes' },
  { id: 'summary', label: 'Short summary' },
  { id: 'definitions', label: 'Key definitions' },
  { id: 'steps', label: 'Step-by-step explanation' },
];

function NotesGeneratorModal({ user, data, onClose }: { user: string; data: DataProp; onClose: () => void }) {
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [pasted, setPasted] = useState('');
  const [topicPrompt, setTopicPrompt] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [style, setStyle] = useState('detailed');
  const [result, setResult] = useState<{ title: string; content: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const material = useMemo(() => {
    if (topicPrompt.trim()) return `Write notes about: ${topicPrompt}`;
    if (pasted.trim()) return pasted;
    return data.notes.find((n: Note) => n.id === selectedNoteId)?.content ?? '';
  }, [topicPrompt, pasted, selectedNoteId, data.notes]);

  const canGenerate = material.trim().length > 0;

  const generate = async () => {
    setLoading(true); setError(''); setResult(null); setSaved(false);
    try {
      const subject = data.subjects.find((s: Subject) => s.id === subjectId)?.name;
      const topic = data.topics.find((t: Topic) => t.id === topicId)?.name;
      const r = await generateNotes({ material: material.slice(0, 12000), style, subject, topic });
      setResult(r);
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!result) return;
    setSaving(true);
    await supabase.from('notes').insert({
      user_id: user,
      title: result.title || 'AI notes',
      content: result.content,
      subject_id: subjectId || null,
      topic_id: topicId || null,
      color: '#f59e0b',
    });
    await logAiContent(user, 'notes', result.title || 'AI notes', { style, content: result.content }, subjectId, topicId, 'notes');
    setSaving(false); setSaved(true); data.refresh();
  };

  return (
    <Modal open onClose={onClose} title="AI Notes Generator" size="xl">
      <div className="space-y-4">
        <div className="flex gap-2">
          <button onClick={() => { setSelectedNoteId(''); setPasted(''); setTopicPrompt(''); }} className={`btn ${!selectedNoteId && !pasted && !topicPrompt ? 'btn-primary' : 'btn-secondary'}`}>From a topic</button>
          <button onClick={() => { setTopicPrompt(''); setPasted(''); }} className={`btn ${selectedNoteId ? 'btn-primary' : 'btn-secondary'}`}>From my notes</button>
          <button onClick={() => { setTopicPrompt(''); setSelectedNoteId(''); }} className={`btn ${pasted ? 'btn-primary' : 'btn-secondary'}`}>From pasted text</button>
        </div>

        {topicPrompt || (!selectedNoteId && !pasted) ? (
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Topic to write notes about</label>
            <input className="input" value={topicPrompt} onChange={(e) => { setTopicPrompt(e.target.value); setSelectedNoteId(''); setPasted(''); }} placeholder="e.g. Photosynthesis for GCSE Biology" />
          </div>
        ) : selectedNoteId || !pasted ? (
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Source note</label>
            <select className="input" value={selectedNoteId} onChange={(e) => { setSelectedNoteId(e.target.value); setPasted(''); }}>
              <option value="">Select a note...</option>
              {data.notes.map((n: Note) => <option key={n.id} value={n.id}>{n.title}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Paste material</label>
            <textarea className="input min-h-[100px]" value={pasted} onChange={(e) => { setPasted(e.target.value); setSelectedNoteId(''); }} placeholder="Paste notes, a transcript or any study material..." />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Note style</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {NOTE_STYLES.map((s) => (
              <button key={s.id} onClick={() => setStyle(s.id)} className={`btn ${style === s.id ? 'btn-primary' : 'btn-secondary'} !py-2 text-xs`}>{s.label}</button>
            ))}
          </div>
        </div>

        <SubjectTopicPicker data={data} subjectId={subjectId} setSubjectId={setSubjectId} topicId={topicId} setTopicId={setTopicId} label="notes file under" />

        <button onClick={generate} disabled={loading || !canGenerate} className="btn btn-primary w-full disabled:opacity-50">
          {loading ? <><RotateCcw size={16} className="animate-spin" /> Writing notes...</> : <><Sparkles size={16} /> Generate notes</>}
        </button>

        <ErrorNote message={error} />

        {result && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">Title (editable)</label>
              <input className="input" value={result.title} onChange={(e) => setResult({ ...result, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">Notes (editable)</label>
              <textarea className="input min-h-[220px] font-mono text-xs" value={result.content} onChange={(e) => setResult({ ...result, content: e.target.value })} />
            </div>
            {!saved ? (
              <button onClick={save} disabled={saving} className="btn btn-primary w-full disabled:opacity-50">
                {saving ? 'Saving...' : <><Save size={16} /> Save to my Notes</>}
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 text-sm text-green-600 py-2">
                <CheckCircle2 size={16} /> Saved — find them on your Notes page.
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- AI Quiz Generator ---------------- */

const QUIZ_TYPES = [
  { id: 'mcq', label: 'Multiple choice' },
  { id: 'short', label: 'Short answer' },
  { id: 'truefalse', label: 'True or false' },
  { id: 'fill_blank', label: 'Fill in the blanks' },
  { id: 'mixed', label: 'Mixed' },
];

type AnswerState = Record<number, string>;
type MarkState = Record<number, boolean>;

function QuizModal({ user, data, onClose }: { user: string; data: DataProp; onClose: () => void }) {
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [pasted, setPasted] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [questionType, setQuestionType] = useState('mcq');
  const [count, setCount] = useState(6);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [marks, setMarks] = useState<MarkState>({});
  const [phase, setPhase] = useState<'setup' | 'active' | 'results'>('setup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const material = useMemo(() => {
    if (pasted.trim()) return pasted;
    return data.notes.find((n: Note) => n.id === selectedNoteId)?.content ?? '';
  }, [pasted, selectedNoteId, data.notes]);

  const generate = async () => {
    setLoading(true); setError(''); setQuestions([]); setPhase('setup');
    try {
      const subject = data.subjects.find((s: Subject) => s.id === subjectId)?.name;
      const topic = data.topics.find((t: Topic) => t.id === topicId)?.name;
      const qs = await generateQuiz({ material: material.slice(0, 12000), questionType, count, subject, topic });
      setQuestions(qs);
      setAnswers({}); setMarks({}); setPhase('active');
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const normalise = (s: string) => s.trim().toLowerCase().replace(/[.?!]$/, '');

  const submit = async () => {
    const nextMarks: MarkState = {};
    questions.forEach((q, i) => {
      const given = answers[i]?.trim();
      if (!given) { nextMarks[i] = false; return; }
      if (q.type === 'short') {
        // Accept answers matching most keywords of the model answer.
        const keywords = normalise(q.answer).split(/\s+/).filter((w) => w.length > 3);
        const hit = keywords.filter((w) => normalise(given).includes(w)).length;
        nextMarks[i] = keywords.length === 0 || hit / keywords.length >= 0.6;
      } else {
        nextMarks[i] = normalise(given) === normalise(q.answer);
      }
    });
    setMarks(nextMarks);
    setPhase('results');

    // Quiz results feed the topic's confidence so revision planning adapts.
    if (topicId) {
      const score = Object.values(nextMarks).filter(Boolean).length;
      const pct = score / Math.max(1, questions.length);
      const topic = data.topics.find((t: Topic) => t.id === topicId);
      if (topic) {
        const newConfidence = Math.min(5, Math.max(1, Math.round(topic.is_difficult ? pct * 3 : pct * 5)));
        await supabase.from('topics').update({ is_difficult: pct < 0.5 }).eq('id', topicId);
        void newConfidence;
      }
    }
    await logAiContent(user, 'quiz', `${data.subjects.find((s: Subject) => s.id === subjectId)?.name ?? 'Quiz'} — ${count} questions`, { questions, answers, marks }, subjectId, topicId, 'quiz');
    data.refresh();
  };

  const score = Object.values(marks).filter(Boolean).length;

  return (
    <Modal open onClose={onClose} title="AI Quiz Generator" size="xl">
      {phase === 'setup' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Source note</label>
            <select className="input" value={selectedNoteId} onChange={(e) => { setSelectedNoteId(e.target.value); setPasted(''); }}>
              <option value="">Select a note...</option>
              {data.notes.map((n: Note) => <option key={n.id} value={n.id}>{n.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Or paste material</label>
            <textarea className="input min-h-[100px]" value={pasted} onChange={(e) => { setPasted(e.target.value); setSelectedNoteId(''); }} placeholder="Paste study material to quiz yourself on..." />
          </div>
          <SubjectTopicPicker data={data} subjectId={subjectId} setSubjectId={setSubjectId} topicId={topicId} setTopicId={setTopicId} label="results link to" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">Question type</label>
              <select className="input" value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
                {QUIZ_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">Questions: {count}</label>
              <input type="range" min={3} max={12} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full mt-2" />
            </div>
          </div>
          <button onClick={generate} disabled={loading || !material.trim()} className="btn btn-primary w-full disabled:opacity-50">
            {loading ? <><RotateCcw size={16} className="animate-spin" /> Writing questions...</> : <><ListChecks size={16} /> Generate quiz</>}
          </button>
          <ErrorNote message={error} />
        </div>
      )}

      {(phase === 'active' || phase === 'results') && questions.length > 0 && (
        <div className="space-y-4">
          {phase === 'results' && (
            <div className={`rounded-lg p-4 text-center ${score / questions.length >= 0.6 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              <p className="text-2xl font-bold text-primary">{score} / {questions.length}</p>
              <p className="text-sm text-secondary mt-1">
                {score / questions.length >= 0.8 ? 'Excellent work!' : score / questions.length >= 0.6 ? 'Good — review the explanations below.' : 'Keep practising — read the explanations below.'}
              </p>
            </div>
          )}
          {questions.map((q, i) => (
            <div key={i} className="surface-tertiary rounded-lg p-4">
              <div className="flex items-start gap-2 mb-3">
                <span className="text-xs font-semibold text-tertiary mt-1">{i + 1}.</span>
                <p className="text-sm font-medium text-primary flex-1">{q.question}</p>
                {phase === 'results' && (
                  marks[i] ? <CheckCircle2 size={18} className="text-green-500 shrink-0" /> : <X size={18} className="text-red-500 shrink-0" />
                )}
              </div>
              {q.type === 'mcq' && q.options ? (
                <div className="space-y-2">
                  {q.options.map((opt, oi) => {
                    const selected = answers[i] === opt;
                    const isAnswer = phase === 'results' && normalise(opt) === normalise(q.answer);
                    return (
                      <button
                        key={oi}
                        disabled={phase === 'results'}
                        onClick={() => setAnswers({ ...answers, [i]: opt })}
                        className={`w-full text-left text-sm rounded-lg px-3 py-2 border transition-all ${
                          isAnswer ? 'border-green-500 bg-green-500/10 text-primary'
                          : phase === 'results' && selected ? 'border-red-500 bg-red-500/10 text-primary'
                          : selected ? 'border-brand-500 bg-brand-500/10 text-primary' : 'border-app text-secondary hover:border-brand-400'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  className="input" disabled={phase === 'results'}
                  value={answers[i] ?? ''}
                  onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                  placeholder={q.type === 'truefalse' ? 'True or false?' : 'Your answer...'}
                />
              )}
              {phase === 'results' && (
                <div className="mt-3 text-xs text-secondary">
                  <p><span className="font-medium text-primary">Answer:</span> {q.answer}</p>
                  {q.explanation && <p className="mt-1"><span className="font-medium text-primary">Why:</span> {q.explanation}</p>}
                </div>
              )}
            </div>
          ))}
          {phase === 'active' ? (
            <button onClick={submit} className="btn btn-primary w-full"><CheckCircle2 size={16} /> Submit for marking</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { setPhase('setup'); setQuestions([]); setAnswers({}); setMarks({}); }} className="btn btn-secondary flex-1">New quiz</button>
              <button onClick={onClose} className="btn btn-primary flex-1">Done</button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ---------------- AI Interactive Tutor ---------------- */

type TutorMsg = { role: 'tutor' | 'student'; content: string };

function TutorWorkspace({ data, onClose }: { data: DataProp; onClose: () => void }) {
  const { user } = useAuth();
  const [sessionId] = useState(() => crypto.randomUUID());
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [level, setLevel] = useState('beginner');
  const [useMaterial, setUseMaterial] = useState(false);
  const [materialNoteId, setMaterialNoteId] = useState('');
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<TutorMsg[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState<'teach' | 'final_test'>('teach');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  const subject = data.subjects.find((s: Subject) => s.id === subjectId);
  const topic = data.topics.find((t: Topic) => t.id === topicId);

  const callTutor = async (history: TutorMsg[], studentMessage?: string) => {
    if (!user) return '';
    const material = useMaterial && materialNoteId
      ? data.notes.find((n: Note) => n.id === materialNoteId)?.content?.slice(0, 8000)
      : undefined;
    return tutorTurn({
      sessionId, subject: subject?.name ?? 'General', topic: topic?.name ?? 'General',
      level, material, history, stage, studentMessage,
    });
  };

  const persistMessage = async (role: 'tutor' | 'student', content: string) => {
    if (!user) return;
    await supabase.from('tutor_messages').insert({ user_id: user.id, session_id: sessionId, role, content });
  };

  const startLesson = async () => {
    setStarted(true); setThinking(true); setError('');
    try {
      const reply = await callTutor([]);
      setMessages([{ role: 'tutor', content: reply }]);
      await persistMessage('tutor', reply);
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'The tutor could not start. Please try again.');
      setStarted(false);
    } finally {
      setThinking(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    const nextHistory = [...messages, { role: 'student' as const, content: text }];
    setMessages(nextHistory);
    setThinking(true); setError('');
    await persistMessage('student', text);
    try {
      const reply = await callTutor(messages, text);
      const withReply = [...nextHistory, { role: 'tutor' as const, content: reply }];
      setMessages(withReply);
      await persistMessage('tutor', reply);
      if (stage === 'teach' && /knowledge test|let'?s test/i.test(reply)) {
        setStage('final_test');
      }
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'The tutor could not respond. Please try again.');
    } finally {
      setThinking(false);
    }
  };

  const beginFinalTest = () => {
    setStage('final_test');
    setInput("I'm ready for the final knowledge test.");
  };

  if (!started) {
    return (
      <Modal open onClose={onClose} title="AI Interactive Tutor" size="lg">
        <div className="space-y-4">
          <div className="rounded-lg p-3 text-sm text-secondary" style={{ backgroundColor: 'rgba(34,197,94,0.1)' }}>
            The tutor teaches step by step: it explains a concept, checks you understood, corrects mistakes, then moves on. You can interrupt and ask questions at any time. It ends with a short knowledge test.
          </div>
          <SubjectTopicPicker data={data} subjectId={subjectId} setSubjectId={setSubjectId} topicId={topicId} setTopicId={setTopicId} label="to be taught" />
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Explanation level</label>
            <div className="grid grid-cols-4 gap-2">
              {['beginner', 'intermediate', 'advanced', 'exam'].map((lv) => (
                <button key={lv} onClick={() => setLevel(lv)} className={`btn ${level === lv ? 'btn-primary' : 'btn-secondary'} !py-1.5 text-xs capitalize`}>{lv}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-secondary">
              <input type="checkbox" checked={useMaterial} onChange={(e) => setUseMaterial(e.target.checked)} />
              Teach from one of my notes
            </label>
            {useMaterial && (
              <select className="input mt-2" value={materialNoteId} onChange={(e) => setMaterialNoteId(e.target.value)}>
                <option value="">Select a note...</option>
                {data.notes.map((n: Note) => <option key={n.id} value={n.id}>{n.title}</option>)}
              </select>
            )}
          </div>
          <ErrorNote message={error} />
          <button onClick={startLesson} disabled={thinking} className="btn btn-primary w-full disabled:opacity-50">
            {thinking ? <><RotateCcw size={16} className="animate-spin" /> Preparing lesson...</> : <><GraduationCap size={16} /> Start lesson</>}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Tutor session" size="xl">
      <div className="flex flex-col h-[70vh] -mx-6 -my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-app">
          <div>
            <h2 className="font-semibold text-primary">{topic?.name ?? 'General'}</h2>
            <p className="text-xs text-tertiary">{subject?.name} · {level} level{useMaterial && materialNoteId ? ' · using your notes' : ''} · {stage === 'final_test' ? 'final test' : 'teaching'}</p>
          </div>
          <button onClick={onClose} className="btn-ghost btn !p-1.5"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'student' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white ${m.role === 'tutor' ? 'bg-brand-500' : 'bg-green-500'}`}>
                {m.role === 'tutor' ? <Bot size={16} /> : <User size={16} />}
              </div>
              <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${m.role === 'tutor' ? 'surface-tertiary text-primary' : 'bg-brand-500 text-white'}`}>
                {m.content}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white shrink-0"><Bot size={16} /></div>
              <div className="surface-tertiary rounded-xl px-4 py-3"><Spinner size={18} className="text-brand-500" /></div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="px-6 py-4 border-t border-app space-y-3">
          <ErrorNote message={error} />
          {stage === 'teach' && messages.length > 2 && (
            <button onClick={beginFinalTest} className="btn btn-secondary w-full">
              <CheckCircle2 size={16} /> Ask for the final knowledge test
            </button>
          )}
          <div className="flex gap-2">
            <input
              className="input flex-1" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={stage === 'final_test' ? 'Answer the test question...' : 'Answer, or ask anything about the lesson...'}
              disabled={thinking}
            />
            <button onClick={send} disabled={thinking || !input.trim()} className="btn btn-primary !px-4 disabled:opacity-50"><Send size={16} /></button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- YouTube Summariser ---------------- */

function YoutubeModal({ data, onClose }: { data: DataProp; onClose: () => void }) {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof summarizeYoutube>> | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState('');
  const [savedNotes, setSavedNotes] = useState(false);

  const summarise = async () => {
    setLoading(true); setError(''); setResult(null); setSavedNotes(false);
    try {
      const subject = data.subjects.find((s: Subject) => s.id === subjectId)?.name;
      const topic = data.topics.find((t: Topic) => t.id === topicId)?.name;
      const r = await summarizeYoutube(url.trim(), subject, topic);
      setResult(r); setVideoUrl(url.trim());
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Could not summarise that video. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const saveAsNote = async () => {
    if (!user || !result) return;
    const { error } = await supabase.from('notes').insert({
      user_id: user.id,
      title: result.summary.slice(0, 60) || 'YouTube summary',
      content: `${videoUrl}\n\n${result.summary}\n\nKey points:\n${result.key_points.map((p) => `- ${p}`).join('\n')}\n\nKey terms:\n${result.key_terms.map((t) => `- ${t.term}: ${t.definition}`).join('\n')}\n\n${result.notes}`,
      subject_id: subjectId || null, topic_id: topicId || null, color: '#ef4444',
    });
    if (error) { setError(error.message); return; }
    await logAiContent(user.id, 'summary', 'YouTube summary', result, subjectId, topicId, 'youtube', videoUrl);
    setSavedNotes(true); data.refresh();
  };

  return (
    <Modal open onClose={onClose} title="YouTube Summariser" size="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">YouTube video link</label>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
        </div>
        <SubjectTopicPicker data={data} subjectId={subjectId} setSubjectId={setSubjectId} topicId={topicId} setTopicId={setTopicId} label="notes save under" />
        <button onClick={summarise} disabled={loading || !url.trim()} className="btn btn-primary w-full disabled:opacity-50">
          {loading ? <><RotateCcw size={16} className="animate-spin" /> Watching the video...</> : <><Youtube size={16} /> Summarise video</>}
        </button>
        <ErrorNote message={error} />
        {result && (
          <div className="space-y-3">
            <div className="surface-tertiary rounded-lg p-4">
              <h4 className="font-semibold text-primary text-sm mb-1">Summary</h4>
              <p className="text-sm text-secondary whitespace-pre-wrap">{result.summary}</p>
            </div>
            <div className="surface-tertiary rounded-lg p-4">
              <h4 className="font-semibold text-primary text-sm mb-1">Key points</h4>
              <ul className="list-disc list-inside text-sm text-secondary space-y-1">
                {result.key_points.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
            {result.key_terms.length > 0 && (
              <div className="surface-tertiary rounded-lg p-4">
                <h4 className="font-semibold text-primary text-sm mb-1">Key terms</h4>
                {result.key_terms.map((t, i) => (
                  <p key={i} className="text-sm text-secondary"><span className="font-medium text-primary">{t.term}:</span> {t.definition}</p>
                ))}
              </div>
            )}
            {videoUrl && (
              <a href={videoUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-500 hover:underline inline-flex items-center gap-1">
                <Youtube size={14} /> Watch the original video
              </a>
            )}
            <button onClick={saveAsNote} disabled={savedNotes} className="btn btn-primary w-full disabled:opacity-50">
              {savedNotes ? <><CheckCircle2 size={16} /> Saved to Notes</> : <><Save size={16} /> Save as note</>}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
