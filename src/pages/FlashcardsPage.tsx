import { useState, useMemo, useEffect } from 'react';
import { useUserData } from '@/hooks/useUserData';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { generateFlashcards } from '@/lib/aiClient';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState, Spinner, ConfidenceDots, ProgressBar, Badge } from '@/components/ui/Common';
import type { Flashcard, FlashcardDeck, Subject } from '@/lib/supabase';
import {
  Layers, Plus, Edit2, Trash2, Search, Shuffle, ChevronLeft, ChevronRight,
  Check, X, Sparkles, Brain, RotateCcw, FolderPlus, ArrowLeft
} from 'lucide-react';

export function FlashcardsPage() {
  const data = useUserData();
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [editing, setEditing] = useState<Flashcard | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');
  const [studyMode, setStudyMode] = useState(false);
  const [studyCards, setStudyCards] = useState<Flashcard[]>([]);
  const [showAIGen, setShowAIGen] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);

  const selectedDeck = data.flashcardDecks.find((deck) => deck.id === selectedDeckId) ?? null;
  const isUnsortedView = selectedDeckId === '__unsorted__';
  const filtered = useMemo(() => {
    return data.flashcards.filter((card) => {
      if (selectedDeckId === null) return false;
      if (isUnsortedView ? card.deck_id !== null : card.deck_id !== selectedDeckId) return false;
      if (filterSubject !== 'all' && card.subject_id !== filterSubject) return false;
      if (search && !card.front.toLowerCase().includes(search.toLowerCase()) && !card.back.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data.flashcards, search, filterSubject, selectedDeckId, isUnsortedView]);

  if (data.loading) {
    return <div className="flex items-center justify-center py-20"><Spinner size={32} className="text-brand-500" /></div>;
  }

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('flashcards').delete().eq('id', deleteId);
    if (error) console.error('Could not delete flashcard:', error);
    setDeleteId(null);
    data.refresh();
  };

  const startStudy = (shuffle: boolean) => {
    let cards = [...filtered];
    if (shuffle) cards = cards.sort(() => Math.random() - 0.5);
    if (cards.length === 0) return;
    setStudyCards(cards);
    setStudyMode(true);
  };

  const unsortedCount = data.flashcards.filter((card) => !card.deck_id).length;
  const isDeckView = selectedDeckId !== null;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          {isDeckView && (
            <button type="button" onClick={() => { setSelectedDeckId(null); setSearch(''); setFilterSubject('all'); }} className="btn btn-ghost !px-0 !py-1 mb-2 text-sm">
              <ArrowLeft size={15} /> All decks
            </button>
          )}
          <h1 className="text-2xl font-bold text-primary">{isDeckView ? (selectedDeck?.name ?? 'Unsorted cards') : 'Flashcards'}</h1>
          <p className="text-secondary text-sm mt-1">{isDeckView ? `${filtered.length} cards in this deck` : 'Organise your cards into decks, then practise active recall'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isDeckView && <button onClick={() => setShowDeckModal(true)} className="btn btn-secondary"><FolderPlus size={16} /> New deck</button>}
          {isDeckView && <>
            <button onClick={() => setShowAIGen(true)} className="btn btn-secondary"><Sparkles size={16} /> AI generate</button>
            <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn btn-primary"><Plus size={16} /> New card</button>
          </>}
        </div>
      </div>

      {!isDeckView ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="card p-4"><p className="text-2xl font-bold text-primary">{data.flashcards.length}</p><p className="text-xs text-tertiary mt-1">Total cards</p></div>
            <div className="card p-4"><p className="text-2xl font-bold text-primary">{data.flashcards.reduce((sum, card) => sum + card.times_reviewed, 0)}</p><p className="text-xs text-tertiary mt-1">Total reviews</p></div>
            <div className="card p-4"><p className="text-2xl font-bold text-primary">{Math.round(data.flashcards.reduce((sum, card) => sum + (card.times_reviewed > 0 ? card.times_correct / card.times_reviewed : 0), 0) / Math.max(1, data.flashcards.length) * 100)}%</p><p className="text-xs text-tertiary mt-1">Average accuracy</p></div>
            <div className="card p-4"><p className="text-2xl font-bold text-primary">{data.flashcardDecks.length}</p><p className="text-xs text-tertiary mt-1">Decks</p></div>
          </div>
          {data.flashcardDecks.length === 0 && unsortedCount === 0 ? (
            <div className="card">
              <EmptyState icon={<Layers size={48} />} title="Your flashcard library is empty" description="Create a deck to organise your cards, or make a card and add it to a deck later." action={<button onClick={() => setShowDeckModal(true)} className="btn btn-primary"><FolderPlus size={16} /> Create your first deck</button>} />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.flashcardDecks.map((deck) => {
                const count = data.flashcards.filter((card) => card.deck_id === deck.id).length;
                return (
                  <button key={deck.id} type="button" onClick={() => setSelectedDeckId(deck.id)} className="card p-5 text-left hover:shadow-md transition-shadow group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-11 h-11 rounded-xl surface-tertiary flex items-center justify-center text-brand-500"><Layers size={22} /></div>
                      <span className="badge">{count} cards</span>
                    </div>
                    <h2 className="font-semibold text-primary mt-4">{deck.name}</h2>
                    <p className="text-xs text-tertiary mt-1">{deck.subject?.name ?? 'Mixed subjects'}</p>
                    <div className="flex justify-between items-center mt-4 text-sm text-brand-500"><span>Open deck</span><ChevronRight size={16} /></div>
                  </button>
                );
              })}
              {unsortedCount > 0 && (
                <button type="button" onClick={() => setSelectedDeckId('__unsorted__')} className="card p-5 text-left hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3"><div className="w-11 h-11 rounded-xl surface-tertiary flex items-center justify-center text-secondary"><Layers size={22} /></div><span className="badge">{unsortedCount} cards</span></div>
                  <h2 className="font-semibold text-primary mt-4">Unsorted cards</h2>
                  <p className="text-xs text-tertiary mt-1">Cards not assigned to a deck yet</p>
                  <div className="flex justify-between items-center mt-4 text-sm text-brand-500"><span>Organise cards</span><ChevronRight size={16} /></div>
                </button>
              )}
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn btn-secondary"><Plus size={16} /> Add an unsorted card</button>
          </div>
        </>
      ) : (
        <>
          {selectedDeck?.subject && <p className="text-sm text-secondary mb-3">Subject: {selectedDeck.subject.name}</p>}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1 relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" /><input className="input pl-10" placeholder="Search cards in this deck..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <select className="input sm:w-48" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
              <option value="all">All subjects</option>{data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
            <button onClick={() => startStudy(false)} disabled={filtered.length === 0} className="btn btn-secondary disabled:opacity-50"><Brain size={16} /> Study</button>
            <button onClick={() => startStudy(true)} disabled={filtered.length === 0} className="btn btn-secondary disabled:opacity-50"><Shuffle size={16} /> Shuffle</button>
          </div>
          {filtered.length === 0 ? (
            <div className="card"><EmptyState icon={<Layers size={48} />} title="No cards in this deck yet" description="Add cards manually or generate them from one of your notes." action={<button onClick={() => { setEditing(null); setShowModal(true); }} className="btn btn-primary"><Plus size={16} /> Add a card</button>} /></div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((card) => (
                <div key={card.id} className="card p-4 group hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2 min-w-0">{card.subject && <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: card.subject.color }} /><span className="text-xs text-tertiary">{card.subject.name}</span></div>}</div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditing(card); setShowModal(true); }} className="btn-ghost btn !p-1"><Edit2 size={14} /></button>
                      <button onClick={() => setDeleteId(card.id)} className="btn-ghost btn !p-1 text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-primary mb-2 line-clamp-3">{card.front}</p>
                  <div className="border-t border-app pt-2"><p className="text-xs text-secondary line-clamp-2">{card.back}</p></div>
                  <div className="flex items-center justify-between mt-3"><ConfidenceDots value={card.confidence} size={10} /><span className="text-xs text-tertiary">{card.times_reviewed} reviews</span></div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showModal && user && (
        <FlashcardModal card={editing} subjects={data.subjects} topics={data.topics} decks={data.flashcardDecks} userId={user.id}
          defaultDeckId={selectedDeckId && selectedDeckId !== '__unsorted__' ? selectedDeckId : null}
          onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); data.refresh(); }} />
      )}

      {showDeckModal && user && <DeckModal userId={user.id} subjects={data.subjects} onClose={() => setShowDeckModal(false)} onSaved={() => { setShowDeckModal(false); data.refresh(); }} />}

      {showAIGen && user && (
        <AIGenerateModal notes={data.notes} subjects={data.subjects} topics={data.topics} decks={data.flashcardDecks} userId={user.id}
          defaultDeckId={selectedDeckId && selectedDeckId !== '__unsorted__' ? selectedDeckId : null}
          onClose={() => setShowAIGen(false)} onSaved={() => { setShowAIGen(false); data.refresh(); }} />
      )}

      {studyMode && studyCards.length > 0 && <StudyMode cards={studyCards} onClose={() => setStudyMode(false)} onComplete={() => { data.refresh(); }} />}

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete flashcard" message="Are you sure you want to delete this flashcard?" confirmLabel="Delete" />
    </div>
  );
}

function StudyMode({ cards, onClose, onComplete }: { cards: Flashcard[]; onClose: () => void; onComplete: () => void }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<Record<string, 'correct' | 'incorrect'>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const card = cards[index];
  const correctCount = Object.values(results).filter((result) => result === 'correct').length;
  const answeredCount = Object.keys(results).length;
  const selectedResult = results[card.id];

  const moveTo = (nextIndex: number) => {
    setIndex(Math.max(0, Math.min(cards.length - 1, nextIndex)));
    setFlipped(false);
    setError('');
  };

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    const updates = cards.filter((item) => results[item.id]).map((item) => {
      const correct = results[item.id] === 'correct';
      return supabase.from('flashcards').update({
        times_reviewed: item.times_reviewed + 1,
        times_correct: item.times_correct + (correct ? 1 : 0),
        confidence: Math.min(5, Math.max(1, item.confidence + (correct ? 1 : -1))),
      }).eq('id', item.id);
    });
    const outcomes = await Promise.all(updates);
    const failed = outcomes.find((outcome) => outcome.error);
    setSaving(false);
    if (failed?.error) {
      setError('Could not save your review: ' + failed.error.message);
      return;
    }
    onComplete();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6 gap-3">
          <div><span className="text-sm text-secondary">Card {index + 1} of {cards.length}</span><p className="text-xs text-tertiary mt-1">{answeredCount} answered · {correctCount} knew it</p></div>
          <button onClick={onClose} className="btn-ghost btn !p-2" aria-label="Close study session"><X size={18} /></button>
        </div>
        <ProgressBar value={index + 1} max={cards.length} className="mb-6" />
        <button type="button" className="card p-8 min-h-[300px] w-full flex items-center justify-center cursor-pointer text-center mb-4" onClick={() => setFlipped((value) => !value)}>
          <div>
            {card.subject && <Badge color={card.subject.color} className="mb-4">{card.subject.name}</Badge>}
            <p className="text-lg font-medium text-primary mb-2">{flipped ? card.back : card.front}</p>
            <p className="text-xs text-tertiary mt-4">{flipped ? 'Click to see the question' : 'Click to reveal the answer'}</p>
          </div>
        </button>
        {selectedResult && <p className={`text-sm text-center mb-3 ${selectedResult === 'correct' ? 'text-green-500' : 'text-red-500'}`}>Marked: {selectedResult === 'correct' ? 'Knew it' : "Didn't know it"} · You can change this before finishing.</p>}
        {flipped ? (
          <div className="flex flex-wrap gap-3 justify-center mb-5">
            <button onClick={() => setResults((current) => ({ ...current, [card.id]: 'incorrect' }))} className={`btn !px-6 ${selectedResult === 'incorrect' ? 'btn-danger ring-2 ring-red-400' : 'btn-secondary'}`}><X size={18} /> Didn't know</button>
            <button onClick={() => setResults((current) => ({ ...current, [card.id]: 'correct' }))} className={`btn !px-6 ${selectedResult === 'correct' ? 'btn-primary ring-2 ring-green-400' : 'btn-secondary'}`}><Check size={18} /> Knew it</button>
          </div>
        ) : <div className="flex justify-center mb-5"><button onClick={() => setFlipped(true)} className="btn btn-primary">Reveal answer</button></div>}
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => moveTo(index - 1)} disabled={index === 0} className="btn btn-secondary disabled:opacity-50"><ChevronLeft size={16} /> Previous</button>
          <button onClick={finish} disabled={saving || answeredCount === 0} className="btn btn-primary disabled:opacity-50">{saving ? 'Saving…' : 'Finish & save'}</button>
          <button onClick={() => moveTo(index + 1)} disabled={index === cards.length - 1} className="btn btn-secondary disabled:opacity-50">Next <ChevronRight size={16} /></button>
        </div>
        {error && <p role="alert" className="text-sm text-red-500 text-center mt-4">{error}</p>}
      </div>
    </div>
  );
}

function FlashcardModal({ card, subjects, topics, userId, onClose, onSaved }: {
  card: Flashcard | null;
  subjects: any[];
  topics: any[];
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [front, setFront] = useState(card?.front ?? '');
  const [back, setBack] = useState(card?.back ?? '');
  const [subjectId, setSubjectId] = useState(card?.subject_id ?? '');
  const [topicId, setTopicId] = useState(card?.topic_id ?? '');
  const [confidence, setConfidence] = useState(card?.confidence ?? 3);
  const [saving, setSaving] = useState(false);

  const subjectTopics = topics.filter((t) => t.subject_id === subjectId);

  const handleSave = async () => {
    setSaving(true);
    const payload = { front, back, subject_id: subjectId || null, topic_id: topicId || null, confidence };
    if (card) {
      await supabase.from('flashcards').update(payload).eq('id', card.id);
    } else {
      await supabase.from('flashcards').insert({ ...payload, user_id: userId });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={card ? 'Edit flashcard' : 'New flashcard'} size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Front (question)</label>
          <textarea className="input min-h-[80px]" value={front} onChange={(e) => setFront(e.target.value)} placeholder="What is the front of the card?" autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">Back (answer)</label>
          <textarea className="input min-h-[80px]" value={back} onChange={(e) => setBack(e.target.value)} placeholder="What is the answer?" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Subject</label>
            <select className="input" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); }}>
              <option value="">No subject</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">Topic</label>
            <select className="input" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="">No topic</option>
              {subjectTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-2">Confidence</label>
          <ConfidenceDots value={confidence} onChange={setConfidence} size={24} />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving || !front.trim() || !back.trim()} className="btn btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : 'Save card'}
          </button>
        </div>
      </div>
    </Modal>
  );
}


function AIGenerateModal({ notes, subjects, topics, userId, onClose, onSaved }: {
  notes: any[];
  subjects: any[];
  topics: any[];
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [count, setCount] = useState(5);
  const [generated, setGenerated] = useState<{ front: string; back: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const selectedNote = notes.find((n) => n.id === selectedNoteId);

  const generate = async () => {
    if (!selectedNote?.content?.trim()) {
      setError('This note has no content to generate flashcards from.');
      return;
    }

    setLoading(true);
    setGenerated([]);
    setSaved(false);
    setError('');

    try {
      const subject = subjects.find((s) => s.id === subjectId);

      const cards = await generateFlashcards({
        material: selectedNote.content,
        subject: subject?.name,
        topic: selectedNote.title,
        count,
        style: 'Clear, concise question-and-answer cards for active recall. Include definitions, explanations and application questions. Keep answers accurate and based only on the notes.'
      });

      setGenerated(cards);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong while generating flashcards.');
    } finally {
      setLoading(false);
    }
  };

  const saveCards = async () => {
    if (generated.length === 0) return;

    setSaving(true);
    setError('');

    try {
      const rows = generated.map((card) => ({
        user_id: userId,
        subject_id: subjectId || null,
        front: card.front,
        back: card.back,
        confidence: 3,
      }));

      const { error: insertError } = await supabase
        .from('flashcards')
        .insert(rows);

      if (insertError) throw insertError;

      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the flashcards.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="AI generate flashcards" size="lg">
      <div className="space-y-4">
        <div className="bg-brand-500/10 rounded-lg p-3 text-sm text-secondary">
          <Sparkles size={16} className="inline mr-2 text-brand-500" />
          AI will analyse your notes and create flashcards designed to test your understanding.
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-1.5">
            Source note
          </label>
          <select
            className="input"
            value={selectedNoteId}
            onChange={(e) => {
              setSelectedNoteId(e.target.value);
              setGenerated([]);
              setError('');
            }}
          >
            <option value="">Select a note...</option>
            {notes.map((n) => (
              <option key={n.id} value={n.id}>{n.title}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">
              Assign to subject
            </label>
            <select
              className="input"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">No subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1.5">
              Number of cards
            </label>
            <input
              type="number"
              className="input"
              value={count}
              onChange={(e) => setCount(Math.min(20, Math.max(1, Number(e.target.value))))}
              min="1"
              max="20"
            />
          </div>
        </div>

        {selectedNote && (
          <div className="surface-tertiary rounded-lg p-3 max-h-32 overflow-y-auto">
            <p className="text-xs text-tertiary mb-1">Note preview:</p>
            <p className="text-xs text-secondary line-clamp-4">
              {selectedNote.content || 'No content'}
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
            {error}
          </div>
        )}

        <button
          onClick={generate}
          disabled={loading || !selectedNoteId}
          className="btn btn-primary w-full disabled:opacity-50"
        >
          {loading ? (
            <>
              <RotateCcw size={16} className="animate-spin" />
              Generating with AI...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Generate flashcards
            </>
          )}
        </button>

        {generated.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-secondary">
              Generated {generated.length} cards:
            </p>

            {generated.map((card, i) => (
              <div key={i} className="surface-tertiary rounded-lg p-3">
                <p className="text-sm font-medium text-primary">{card.front}</p>
                <p className="text-xs text-secondary mt-1">{card.back}</p>
              </div>
            ))}

            {!saved ? (
              <button
                onClick={saveCards}
                disabled={saving}
                className="btn btn-primary w-full disabled:opacity-50"
              >
                {saving ? 'Saving...' : `Save ${generated.length} cards`}
              </button>
            ) : (
              <div className="text-sm text-green-600 text-center py-2">
                Cards saved successfully!
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
