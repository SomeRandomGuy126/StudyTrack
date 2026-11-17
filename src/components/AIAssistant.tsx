import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useUserData } from '@/hooks/useUserData';
import { agentTurn, AiError } from '@/lib/aiClient';
import {
  X, Send, Bot, Sparkles, Loader2, Maximize2, Minimize2, ChevronDown, ChevronUp,
  RefreshCw, User,
} from 'lucide-react';
import type { AiMessage } from '@/lib/supabase';
import { isOverdue, daysUntil, formatDuration, relativeDate } from '@/lib/spacedRepetition';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AIAssistant({ open, onClose }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [floatingPosition, setFloatingPosition] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number; panel: HTMLDivElement } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingTopicChoice, setPendingTopicChoice] = useState<{
    subjectName: string;
    requestedTopicName: string;
    subtopics: string[];
    matches: { id: string; name: string }[];
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const data = useUserData();

  useEffect(() => {
    if (open && !historyLoaded && user) {
      loadHistory();
      setHistoryLoaded(true);
    }
  }, [open, historyLoaded, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, error]);

  // Grow the message box as the student types, up to 160px.
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = '44px';
    const nextHeight = Math.min(textarea.scrollHeight, 160);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > 160 ? 'auto' : 'hidden';
  }, [input]);

  // Esc closes fullscreen first, then the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (fullscreen) setFullscreen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, fullscreen, onClose]);

  const loadHistory = async () => {
    const { data: history } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true })
      .limit(50);
    if (history && history.length > 0) {
      setMessages(history as AiMessage[]);
    } else {
      setMessages([{
        id: 'welcome',
        user_id: user!.id,
        role: 'assistant',
        content: "Hi! I'm Nova, Ask me anything — I can explain concepts, help with homework, answer general questions, and I know what's in your StudyTrack account so I can help you plan.\n\nTry \"What should I revise today?\", \"Explain photosynthesis simply\" or \"Add a Biology study session about mitosis\".",
        action_taken: null,
        created_at: new Date().toISOString(),
      }]);
    }
  };

  const saveMessage = async (role: 'user' | 'assistant', content: string, action: string | null) => {
    if (!user) return;
    await supabase.from('ai_messages').insert({
      user_id: user.id,
      role,
      content,
      action_taken: action,
    });
  };


  const handleSend = async (textOverride?: string) => {
    const userMessage = (textOverride ?? input).trim();
    if (!userMessage || loading) return;
    setInput('');
    setError(null);
    setLoading(true);

    const tempUserMsg: AiMessage = {
      id: crypto.randomUUID(),
      user_id: user!.id,
      role: 'user',
      content: userMessage,
      action_taken: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    await saveMessage('user', userMessage, null);

    let response = '';
    let action: string | null = null;

    try {
      if (pendingTopicChoice) {
        const choiceText = userMessage.trim();
        const isNew = /^(?:new|new topic|create new|make a new one)$/i.test(choiceText);
        const numberedChoice = choiceText.match(/^(?:use\s+)?(?:option\s+)?([1-9]\d*)$/i);
        const isExisting = /^(?:existing|use existing|existing topic|use the existing one)$/i.test(choiceText);
        const selectedMatch = numberedChoice
          ? pendingTopicChoice.matches[Number(numberedChoice[1]) - 1]
          : isExisting && pendingTopicChoice.matches.length === 1
            ? pendingTopicChoice.matches[0]
            : null;

        if (!isNew && !selectedMatch) {
          response = pendingTopicChoice.matches.length > 1
            ? 'Please choose an existing topic by number, or reply "new" to create a separate topic.'
            : 'Please reply "existing" to use the topic I found, or "new" to create a separate topic.';
        } else {
          const chosenTopicName = selectedMatch?.name ?? pendingTopicChoice.requestedTopicName;
          const execution = await executeAgentAction({
            type: 'create_topics_bulk',
            payload: {
              subject_name: pendingTopicChoice.subjectName,
              topics: [{
                name: chosenTopicName,
                year: 12,
                subtopics: pendingTopicChoice.subtopics,
              }],
            },
          }, data, user!.id);
          response = execution.summary;
          if (execution.success) action = execution.summary;
          setPendingTopicChoice(null);
          await data.refresh();
        }
      } else {
      // Route explicit topic and subtopic creation requests deterministically.
      // This avoids depending on the model to invent action names or payload fields.
      // Handle a specifically targeted parent topic before curriculum imports.
      // Otherwise an older curriculum list in chat history can be mistaken for
      // the current request and bypass the existing-topic confirmation.
      const namedSubtopicsRequest = extractNamedSubtopicsRequest(
        userMessage, data.topics, data.subjects
      );
      const generatedSubtopicsRequest = namedSubtopicsRequest
        ? null
        : extractAqaTopicSubtopicsRequest(userMessage, data.topics, data.subjects);
      const subtopicsBulkRequest = namedSubtopicsRequest || generatedSubtopicsRequest
        ? null
        : extractSubtopicsBulkRequest(userMessage, data.subjects);
      const subtopicRequest = namedSubtopicsRequest || generatedSubtopicsRequest || subtopicsBulkRequest
        ? null
        : extractCreateSubtopicRequest(userMessage, data.topics, data.subjects);
      // A direct request to create one topic must take priority over curriculum
      // imports inferred from earlier chat history. Otherwise an old syllabus
      // list can hijack a simple request such as "Create a new topic called X in Biology".
      const topicRequest = namedSubtopicsRequest || generatedSubtopicsRequest || subtopicsBulkRequest || subtopicRequest
        ? null
        : extractCreateTopicRequest(userMessage, data.subjects);
      const bulkRequest = namedSubtopicsRequest || generatedSubtopicsRequest || subtopicsBulkRequest || subtopicRequest || topicRequest
        ? null
        : extractBulkCurriculumRequest(userMessage, messages, data.subjects);
      const bulkAction = generatedSubtopicsRequest ?? subtopicsBulkRequest ?? bulkRequest;
      const directRequest = namedSubtopicsRequest
        ? { type: 'create_subtopics_bulk', payload: namedSubtopicsRequest }
        : bulkAction
          ? { type: 'create_topics_bulk', payload: bulkAction }
        : subtopicRequest
          ? { type: 'create_subtopic', payload: subtopicRequest }
          : topicRequest
            ? { type: 'create_topic', payload: topicRequest }
            : null;
      if (directRequest) {
        const singleBulkTopic = bulkAction?.topics.length === 1 ? bulkAction.topics[0] : null;
        if (bulkAction && singleBulkTopic && singleBulkTopic.subtopics.length > 0) {
          const subject = data.subjects.find(
            (item) => item.name.trim().toLowerCase() === bulkAction.subject_name.trim().toLowerCase()
          );
          if (!subject) {
            response = 'I could not identify the subject, so no subtopics were added.';
          } else {
            const { data: existingRows, error: existingError } = await supabase
              .from('topics')
              .select('id, name, parent_id')
              .eq('subject_id', subject.id);
            if (existingError) {
              response = 'I could not check your existing topics, so I stopped without adding anything. Please try again.';
            } else {
              const normalizeTopicName = (value: string) => value
                .normalize('NFKC')
                .trim()
                .replace(/^(?:the\s+)?topic\s*/i, '')
                .replace(/^\d+\s*:\s*/, '')
                .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '')
                .replace(/\s+/g, ' ')
                .replace(/[.!?]+$/g, '')
                .toLowerCase();
              const requestedKey = normalizeTopicName(singleBulkTopic.name);
              const matches = (existingRows ?? [])
                .filter((row) => !row.parent_id && normalizeTopicName(row.name) === requestedKey)
                .map((row) => ({ id: row.id, name: row.name }));
              if (matches.length > 0) {
                setPendingTopicChoice({
                  subjectName: subject.name,
                  requestedTopicName: singleBulkTopic.name,
                  subtopics: singleBulkTopic.subtopics,
                  matches,
                });
                response = matches.length === 1
                  ? 'I found an existing topic in Biology: "' + matches[0].name + '".\n\nDo you want me to add these subtopics to that existing topic, or create a new topic instead? Reply "existing" or "new".'
                  : 'I found more than one existing topic that could match "' + singleBulkTopic.name + '":\n' +
                    matches.map((item, index) => (index + 1) + '. ' + item.name).join('\n') +
                    '\n\nReply with the number of the topic you want to use, or "new" to create a separate topic.';
              } else {
                const execution = await executeAgentAction(directRequest, data, user!.id);
                response = execution.summary;
                if (execution.success) action = execution.summary;
                await data.refresh();
              }
            }
          }
        } else {
          const execution = await executeAgentAction(directRequest, data, user!.id);
          response = execution.summary;
          if (execution.success) action = execution.summary;
          await data.refresh();
        }
      } else {
        const context = buildAppContext(data);
        const history = messages
          .filter((m) => m.id !== 'welcome')
          .slice(-12)
          .map((m) => ({
            role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
            content: m.content,
          }));

        const result = await agentTurn({
          message: userMessage,
          history,
          context,
        });

        const successfulActions: string[] = [];
        const failedActions: string[] = [];

        for (const agentAction of result.actions) {
          if (
            !agentAction ||
            typeof agentAction.type !== 'string' ||
            !agentAction.payload ||
            typeof agentAction.payload !== 'object' ||
            Array.isArray(agentAction.payload)
          ) {
            failedActions.push('The AI returned an invalid action, so no change was made.');
            continue;
          }

          const execution = await executeAgentAction(agentAction, data, user!.id);
          if (execution.success) successfulActions.push(execution.summary);
          else failedActions.push(execution.summary);
        }

        if (result.actions.length > 0) {
          // For app changes, show only the website's verified result.
          response = [...successfulActions, ...failedActions].join('\n\n');
          if (successfulActions.length > 0) {
            action = successfulActions.join(' ');
            await data.refresh();
          }
        } else {
          // Never let the language model claim that an app change happened
          // when it returned no executable action. A conversational reply is
          // not proof that anything was written to Supabase.
          const requestedAppChange =
            /\b(add|create|make|save|update|edit|delete|remove|log|schedule|complete|mark|import|populate)\b/i.test(userMessage) &&
            /\b(subject|topic|subtopic|task|note|flashcard|study session|revision|event|calendar|curriculum|syllabus|biology)\b/i.test(userMessage);
          response = requestedAppChange
            ? "I haven't changed anything. The AI did not return a save action, so nothing was written to your StudyTrack account. Please try again with a specific request."
            : result.message;
        }
      }
      }
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Something went wrong. Please try again.');
      setLoading(false);
      return;
    }

    const assistantMsg: AiMessage = {
      id: crypto.randomUUID(),
      user_id: user!.id,
      role: 'assistant',
      content: response,
      action_taken: action,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMsg]);
    await saveMessage('assistant', response, action);

    
    setLoading(false);
  };

  const startNewChat = async () => {
    if (!user) return;
    await supabase.from('ai_messages').delete().eq('user_id', user.id);
    setMessages([{
      id: 'welcome',
      user_id: user.id,
      role: 'assistant',
      content: "New chat started. Ask me anything!",
      action_taken: null,
      created_at: new Date().toISOString(),
    }]);
    setError(null);
  };

  const suggestions = [
    "What should I revise today?",
    "Explain photosynthesis simply",
    "Show me overdue revisions",
    "Add a Biology study session",
  ];

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (fullscreen || event.button !== 0 || (event.target as HTMLElement).closest('button, input, textarea, a')) return;
    const panel = event.currentTarget.parentElement as HTMLDivElement | null;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      originX: rect.left, originY: rect.top, panel,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !drag.panel) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    // Move the panel directly during the gesture. Avoid a React render for every pointer event.
    drag.panel.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
  };
  const handleDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current as (NonNullable<typeof dragRef.current> & { panel?: HTMLDivElement }) | null;
    if (!drag || drag.pointerId !== event.pointerId || !drag.panel) return;
    const panel = drag.panel;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const x = Math.max(8, Math.min(window.innerWidth - width - 8, drag.originX + dx));
    const y = Math.max(8, Math.min(window.innerHeight - Math.min(height, 120) - 8, drag.originY + dy));
    panel.style.transform = '';
    dragRef.current = null;
    setFloatingPosition({ x, y });
  };
  const floatingStyle: React.CSSProperties = fullscreen ? {
    left: 0, top: 0, right: 0, bottom: 0, width: '100vw', height: '100dvh',
    minWidth: 0, minHeight: 0, maxWidth: '100vw', maxHeight: '100dvh',
    resize: 'none', borderRadius: 0,
  } : {
    left: floatingPosition?.x, top: floatingPosition?.y,
    right: floatingPosition ? 'auto' : 24, bottom: floatingPosition ? 'auto' : 24,
    width: 'min(440px, calc(100vw - 16px))',
    height: minimized ? 'auto' : 'min(600px, calc(100vh - 48px))',
    minWidth: 'min(320px, calc(100vw - 16px))', minHeight: minimized ? 'auto' : 260,
    maxWidth: 'calc(100vw - 16px)', maxHeight: 'calc(100vh - 16px)',
    resize: minimized ? 'none' : 'both', overflow: 'hidden',
  };

  return (
    <>
      <div className={`fixed z-50 flex flex-col border border-app shadow-2xl ${fullscreen ? '' : 'rounded-2xl'} ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ ...floatingStyle, backgroundColor: 'var(--bg-secondary)', boxShadow: '0 20px 70px rgb(0 0 0 / 0.24)', transition: 'opacity 140ms ease', willChange: 'left, top' }} aria-hidden={!open}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-app shrink-0 cursor-grab active:cursor-grabbing select-none"
          onPointerDown={handleDragStart} onPointerMove={handleDragMove} onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd} style={{ touchAction: 'none' }}>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, var(--accent-secondary), var(--accent))' }}>
              <Bot size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-primary">Nova</h3>
              <p className="text-xs text-tertiary">{fullscreen ? 'Full screen' : 'Your StudyTrack study companion'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={startNewChat} title="Start a new chat" className="btn-ghost btn !p-2"><RefreshCw size={16} /></button>
            <button onClick={() => setMinimized((value) => !value)} title={minimized ? 'Expand Nova' : 'Minimise Nova'} className="btn-ghost btn !p-2">{minimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
            <button onClick={() => { setMinimized(false); setFullscreen((value) => !value); }}
              title={fullscreen ? 'Exit full screen' : 'Full screen'} className="btn-ghost btn !p-2">
              {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button onClick={onClose} title="Close Nova" className="btn-ghost btn !p-2"><X size={18} /></button>
          </div>
        </div>

        {!minimized && <>
        {/* Messages */}
        <div ref={scrollRef} className={`flex-1 overflow-y-auto px-4 py-4 space-y-3 ${fullscreen ? 'mx-auto w-full max-w-3xl' : ''}`}>
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center mt-1 ${
                    msg.role === 'user' ? 'bg-brand-100 text-brand-700' : 'text-white'
                  }`}
                  style={msg.role === 'assistant' ? { background: 'linear-gradient(135deg, var(--accent-secondary), var(--accent))' } : undefined}
                >
                  {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div
                  className={`rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-brand-500 text-white rounded-br-sm'
                      : 'surface-tertiary text-primary rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  {msg.action_taken && (
                    <div className="mt-2 pt-2 border-t border-app/50 flex items-center gap-1.5 text-xs opacity-70">
                      <Sparkles size={12} />
                      <span>{msg.action_taken}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="surface-tertiary rounded-2xl rounded-bl-sm px-4 py-3">
                <Loader2 size={16} className="animate-spin text-brand-500" />
              </div>
            </div>
          )}
          {error && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-3 bg-red-50 text-red-700 border border-red-200 max-w-[85%]">
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && !loading && (
          <div className={`px-4 pb-2 flex flex-wrap gap-2 ${fullscreen ? 'mx-auto w-full max-w-3xl' : ''}`}>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="text-xs px-3 py-1.5 rounded-full surface-tertiary text-secondary hover:text-primary transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className={`px-4 py-3 border-t border-app shrink-0 ${fullscreen ? 'mx-auto w-full max-w-3xl' : ''}`}>
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              className="input min-h-[44px] max-h-40 resize-none overflow-y-hidden"
              placeholder="Ask me anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              autoFocus={open}
            />
            <button onClick={() => handleSend()} disabled={loading || !input.trim()} className="btn btn-primary !p-2.5 disabled:opacity-50 shrink-0">
              <Send size={18} />
            </button>
          </div>
        </div>
        </>}
      </div>
    </>
  );
}


// Compact summary of the student's StudyTrack data, so the AI can give
// personalised answers without being told anything.
function buildAppContext(data: ReturnType<typeof useUserData>): string {
  const overdue = data.revisions.filter((r) => r.status === 'due' && isOverdue(r.next_due_date));
  const upcoming = data.revisions
    .filter((r) => r.status === 'due' && daysUntil(r.next_due_date) >= 0)
    .sort((a, b) => new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime())
    .slice(0, 5);
  const totalMinutes = data.studySessions.reduce((sum, s) => sum + s.duration_minutes, 0);
  const openTasks = data.tasks.filter((t) => t.status !== 'completed').slice(0, 5);
  const difficult = data.topics.filter((t) => t.is_difficult).slice(0, 5);

  const lines: string[] = [];
  lines.push(`Subjects: ${data.subjects.map((s) => s.name).join(', ') || 'none yet'}.`);
  if (data.topics.length) {
    lines.push(`Topics and subtopics: ${data.topics.slice(0, 30).map((t) => {
      const subjectName = data.subjects.find((subject) => subject.id === t.subject_id)?.name ?? '?';
      const parentName = t.parent_id ? data.topics.find((parent) => parent.id === t.parent_id)?.name : null;
      return parentName ? `${t.name} (subtopic of ${parentName}, ${subjectName})` : `${t.name} (${subjectName})`;
    }).join('; ')}.`);
  }
  lines.push(`Total study time logged: ${formatDuration(totalMinutes)} across ${data.studySessions.length} sessions.`);
  lines.push(`Overdue revisions: ${overdue.length}${overdue.length ? ` (${overdue.slice(0, 5).map((r) => `${r.topic?.name} — ${relativeDate(r.next_due_date)}`).join('; ')})` : ''}.`);
  if (upcoming.length) {
    lines.push(`Upcoming revisions: ${upcoming.map((r) => `${r.topic?.name} — ${relativeDate(r.next_due_date)}`).join('; ')}.`);
  }
  if (openTasks.length) lines.push(`Open tasks: ${openTasks.map((t) => t.title).join('; ')}.`);
  if (difficult.length) lines.push(`Topics the student finds difficult: ${difficult.map((t) => t.name).join(', ')}.`);
  lines.push(`Flashcards in deck: ${data.flashcards.length}.`);
  return lines.join('\n');
}


type StudyAgentAction = {
  type: string;
  payload: Record<string, unknown>;
};

type ActionExecutionResult = {
  success: boolean;
  summary: string;
};

function normalizeSubject(value: string): string {
  return value.trim().replace(/^(?:(?:the\s+)?subject\s+)/i, '').trim();
}

function extractAqaTopicSubtopicsRequest(
  message: string,
  topics: { id: string; name: string; subject_id: string; parent_id: string | null }[],
  subjects: { id: string; name: string }[]
): { subject_name: string; topics: BulkCurriculumTopic[] } | null {
  const match = message.trim().match(
    /^(?:please\s+|can you\s+|could you\s+|would you\s+)*(?:now\s+)?(?:add|create|generate)\s+(?:the\s+)?(?:appropriate|relevant|suitable)?\s*subtopics\s+(?:to|under|for)\s+(?:the\s+)?topic\s+(.+?)\s+(?:in|under|for)\s+(?:(?:the\s+)?subject\s+)?(.+?)(?:\s+please)?[.!?]*$/i
  );
  if (!match) return null;

  const clean = (value: string) =>
    value.trim().replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '').replace(/[.!?]+$/, '').trim();
  const topicName = clean(match[1]);
  const subjectName = clean(match[2]);
  const subject = subjects.find((item) => item.name.trim().toLowerCase() === subjectName.toLowerCase());
  if (!subject || subject.name.trim().toLowerCase() !== 'biology') return null;

  const parent = topics.find((item) =>
    !item.parent_id &&
    item.subject_id === subject.id &&
    item.name.trim().toLowerCase() === topicName.toLowerCase()
  );
  if (!parent) return null;

  // AQA A-level Biology 7402, Topic 1: Biological molecules.
  // These are specification content areas, not required practicals.
  const topicOneNames = ['topic 1: biological molecules', 'biological molecules'];
  if (!topicOneNames.includes(parent.name.trim().toLowerCase())) return null;

  return {
    subject_name: subject.name,
    topics: [{
      name: parent.name,
      year: 12,
      subtopics: [
        'Monomers and polymers',
        'Carbohydrates',
        'Lipids',
        'Proteins',
        'Nucleic acids (DNA and RNA)',
        'ATP',
        'Water',
        'Inorganic ions',
      ],
    }],
  };
}

function extractCreateTopicRequest(
  message: string,
  subjects: { name: string }[]
): { name: string; subject_name: string } | null {
  const clean = (value: string) =>
    value.trim().replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '').replace(/[.!?]+$/, '').trim();

  // Also accept natural phrasing where the subject comes before the topic name:
  // "Create a topic in Biology called 'Topic 1: Biological molecules'".
  const subjectFirst = message.trim().match(
    /^(?:please\s+|can you\s+|could you\s+|would you\s+)*(?:add|create|make)\s+(?:(?:a\s+new|a|the|new)\s+)?topic\s+(?:in|under|for|to)\s+(.+?)\s+(?:called|named)\s+(.+?)(?:\s+please)?[.!?]*$/i
  );
  if (subjectFirst) {
    const requestedSubject = normalizeSubject(subjectFirst[1]);
    const name = clean(subjectFirst[2]);
    const subject = subjects.find(
      (item) => item.name.trim().toLowerCase() === requestedSubject.toLowerCase()
    );
    if (name && subject) return { name, subject_name: subject.name };
  }

  const patterns = [
    /^(?:please\s+|can you\s+|could you\s+|would you\s+)*(?:add|create|make)\s+(?:(?:a\s+new|a|the|new)\s+)?topic\s+(?:called|named)\s+(.+?)\s+(?:to|in|under|for)\s+(.+?)(?:\s+please)?[.!?]*$/i,
    /^(?:please\s+|can you\s+|could you\s+|would you\s+)*(?:add|create|make)\s+(?:(?:a\s+new|a|the|new)\s+)?topic\s+(.+?)\s+(?:to|in|under|for)\s+(.+?)(?:\s+please)?[.!?]*$/i,
    /^(?:please\s+|can you\s+|could you\s+|would you\s+)*(?:add|create|make)\s+(.+?)\s+as\s+a\s+topic\s+(?:to|in|under|for)\s+(.+?)(?:\s+please)?[.!?]*$/i,
  ];

  for (const pattern of patterns) {
    const match = message.trim().match(pattern);
    if (!match) continue;

    const name = clean(match[1]);
    const requestedSubject = normalizeSubject(match[2]);
    if (!name || !requestedSubject) continue;

    const subject = subjects.find(
      (item) => item.name.trim().toLowerCase() === requestedSubject.toLowerCase()
    );
    return { name, subject_name: subject?.name ?? requestedSubject };
  }

  return null;
}

function extractNamedSubtopicsRequest(
  message: string,
  topics: { id: string; name: string; subject_id: string; parent_id: string | null }[],
  subjects: { id: string; name: string }[]
): { subject_name: string; parent_topic_name: string; subtopics: string[] } | null {
  const text = message.trim();
  if (!/^(?:please\s+)?add\s+these\s+subtopics\b/i.test(text)) return null;
  const separator = text.match(/\bto\b/i);
  if (!separator || separator.index === undefined) return null;
  const left = text.slice(0, separator.index);
  const right = text.slice(separator.index + separator[0].length);
  const subtopicNames = [...new Set(
    [...left.matchAll(/"([^"]+)"|'([^']+)'/g)]
      .map((match) => (match[1] ?? match[2] ?? '').trim())
      .filter(Boolean)
  )];
  const parentMatch = right.match(/"([^"]+)"|'([^']+)'/);
  const parentName = (parentMatch?.[1] ?? parentMatch?.[2] ??
    right.replace(/^\s*(?:(?:the\s+)?topic\s+)/i, '').trim()).trim();
  if (subtopicNames.length === 0 || subtopicNames.length > 30 || !parentName) return null;
  const parentMatches = topics.filter((topic) =>
    !topic.parent_id && topic.name.trim().toLowerCase() === parentName.toLowerCase()
  );
  if (parentMatches.length !== 1) return null;
  const subject = subjects.find((item) => item.id === parentMatches[0].subject_id);
  if (!subject) return null;
  return { subject_name: subject.name, parent_topic_name: parentMatches[0].name, subtopics: subtopicNames };
}

function extractSubtopicsBulkRequest(
  message: string,
  subjects: { id: string; name: string }[]
): { subject_name: string; topics: BulkCurriculumTopic[] } | null {
  const text = message.trim().replace(/[.!?]+$/, '');
  const match = text.match(
    /^(?:please\s+|can you\s+|could you\s+|would you\s+)*(?:now\s+)?(?:add|create|make)\s+(.+?)\s+as\s+(?:a\s+)?subtopics?\s+(?:to|under|of|within)\s+(?:(?:the\s+)?topic\s+)?(.+?)\s+(?:in|under|for)\s+(.+?)\s*$/i
  );
  if (!match) return null;

  const clean = (value: string) =>
    value.trim().replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '').trim();
  const subjectInput = clean(match[3]).replace(/^(?:the\s+)?subject\s+/i, '');
  const subject = subjects.find((item) =>
    item.name.trim().toLowerCase() === subjectInput.toLowerCase()
  );
  if (!subject) return null;

  const parentName = clean(match[2]).replace(/^(?:the\s+)?topic\s+/i, '');
  const names = match[1].split(/\s*,\s*|\s+and\s+/i)
    .map(clean)
    .filter(Boolean);
  if (!parentName || names.length === 0 || names.length > 30) return null;

  return {
    subject_name: subject.name,
    topics: [{ name: parentName, year: 12, subtopics: [...new Set(names)] }],
  };
}

function extractCreateSubtopicRequest(
  message: string,
  topics: { id: string; name: string; subject_id: string; parent_id: string | null }[],
  subjects: { id: string; name: string }[]
): { name: string; parent_topic_name: string; subject_name: string } | null {
  const text = message.trim().replace(/[.!?]+$/, '');
  const patterns = [
    /^(?:please\s+|can you\s+|could you\s+|would you\s+)*(?:add|create|make)\s+(?:a\s+|new\s+)?subtopic\s+(?:called\s+|named\s+)?(.+?)\s+(?:to|under|inside|within)\s+(?:the\s+)?(?:topic\s+)?(.+?)\s+(?:in|under|for)\s+(.+?)(?:\s+please)?$/i,
    /^(?:please\s+|can you\s+|could you\s+|would you\s+)*(?:add|create|make)\s+(?:a\s+|new\s+)?subtopic\s+(?:called\s+|named\s+)?(.+?)\s+(?:to|under|inside|within)\s+(?:the\s+)?(?:topic\s+)?(.+?)(?:\s+please)?$/i,
    /^(?:please\s+|can you\s+|could you\s+|would you\s+)*(?:add|create|make)\s+(.+?)\s+as\s+a\s+subtopic\s+(?:of|under)\s+(?:the\s+)?(?:topic\s+)?(.+?)(?:\s+in\s+(.+?))?(?:\s+please)?$/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const clean = (value: string) => value.trim().replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '').trim();
    const name = clean(match[1]);
    const parentName = clean(match[2]);
    const requestedSubject = match[3] ? clean(match[3]) : '';
    if (!name || !parentName) continue;
    const parentMatches = topics.filter(t => t.name.trim().toLowerCase() === parentName.toLowerCase());
    const parent = requestedSubject
      ? parentMatches.find(t => subjects.find(s => s.id === t.subject_id)?.name.toLowerCase() === requestedSubject.toLowerCase())
      : parentMatches.length === 1 ? parentMatches[0] : null;
    if (!parent) {
      return { name, parent_topic_name: parentName, subject_name: requestedSubject };
    }
    const subject = subjects.find(s => s.id === parent.subject_id);
    if (subject) return { name, parent_topic_name: parent.name, subject_name: subject.name };
  }
  return null;
}

type BulkCurriculumTopic = {
  name: string;
  year: 12 | 13;
  subtopics: string[];
};

function extractBulkCurriculumRequest(
  message: string,
  history: AiMessage[],
  subjects: { name: string }[]
): { subject_name: string; topics: BulkCurriculumTopic[] } | null {
  const biology = subjects.find((subject) => subject.name.trim().toLowerCase() === 'biology');
  if (!biology) return null;

  const asksToAdd = /\b(add|import|populate|create|put)\b/i.test(message) &&
    /\b(curriculum|topics|biology|syllabus|list)\b/i.test(message);
  const candidates = [
    message,
    ...history.slice(-10).reverse().map((item) => item.content),
  ];

  for (const source of candidates) {
    const lines = source.split(/\r?\n/);
    const topics: BulkCurriculumTopic[] = [];
    let currentYear: 12 | 13 | null = null;
    let currentTopic: BulkCurriculumTopic | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      const yearMatch = line.match(/\bYear\s*(12|13)\b/i);
      if (yearMatch) currentYear = Number(yearMatch[1]) as 12 | 13;

      const topicMatch = line.match(/^\*{0,2}\s*Topic\s*(\d+)\s*:\s*(.+?)\s*\*{0,2}$/i);
      if (topicMatch) {
        if (currentTopic) topics.push(currentTopic);
        const number = Number(topicMatch[1]);
        const inferredYear = currentYear ?? (number <= 4 ? 12 : 13);
        currentTopic = {
          name: topicMatch[2].replace(/\*{1,2}/g, '').trim(),
          year: inferredYear,
          subtopics: [],
        };
        continue;
      }

      if (currentTopic && /^[-*]\s+/.test(line)) {
        const subtopic = line.replace(/^[-*]\s+/, '').replace(/\*{1,2}/g, '').trim();
        if (!subtopic || /\b(required\s+practical|practical|experiment|investigation)\b/i.test(subtopic)) continue;
        if (!currentTopic.subtopics.some((item) => item.toLowerCase() === subtopic.toLowerCase())) {
          currentTopic.subtopics.push(subtopic);
        }
      }
    }
    if (currentTopic) topics.push(currentTopic);

    const uniqueTopics = [...new Map(
      topics.filter((topic) => topic.name && topic.subtopics.length > 0)
        .map((topic) => [topic.name.toLowerCase(), topic])
    ).values()];
    if (uniqueTopics.length >= 2 && (asksToAdd || uniqueTopics.length >= 8)) {
      return { subject_name: biology.name, topics: uniqueTopics };
    }
  }

  return null;
}

async function executeAgentAction(
  action: StudyAgentAction,
  data: ReturnType<typeof useUserData>,
  userId: string
): Promise<ActionExecutionResult> {
  const p = action.payload;

  const getText = (key: string): string =>
    typeof p[key] === 'string' ? (p[key] as string).trim() : '';

  const findSubject = (name: string) =>
    data.subjects.find(
      (subject) => subject.name.toLowerCase() === name.toLowerCase()
    );

  const findTopic = (name: string, subjectId: string) =>
    data.topics.find(
      (topic) =>
        topic.name.toLowerCase() === name.toLowerCase() &&
        topic.subject_id === subjectId
    );

  const failed = (summary: string): ActionExecutionResult => ({
    success: false,
    summary,
  });

  try {
    switch (action.type) {
      case 'create_topics_bulk': {
        const subjectName = getText('subject_name');
        const rawTopics = p.topics;
        if (!subjectName || !Array.isArray(rawTopics) || rawTopics.length === 0 || rawTopics.length > 30) {
          return failed('A subject and a valid list of up to 30 topics are required. No changes were made.');
        }

        const { data: subjectRows, error: subjectError } = await supabase
          .from('subjects').select('id, name').eq('user_id', userId);
        if (subjectError) return failed('I could not check your subjects, so no curriculum entries were added.');
        const subject = (subjectRows ?? []).find((item) => item.name.trim().toLowerCase() === subjectName.toLowerCase());
        if (!subject) return failed('I could not find the subject "' + subjectName + '". No curriculum entries were added.');

        const parsedTopics = rawTopics.map((item) => {
          const row = item as Record<string, unknown>;
          const year = Number(row.year);
          const subtopics = Array.isArray(row.subtopics)
            ? row.subtopics.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean)
            : [];
          return {
            name: typeof row.name === 'string' ? row.name.trim() : '',
            year: year === 13 ? 13 : 12,
            subtopics: [...new Set(subtopics)],
          };
        }).filter((item) => item.name && item.subtopics.length > 0);

        if (parsedTopics.length === 0) return failed('The curriculum list did not contain valid topics and subtopics. Nothing was added.');
        const totalRequested = parsedTopics.reduce((sum, topic) => sum + 1 + topic.subtopics.length, 0);
        if (totalRequested > 600) return failed('This curriculum is too large for one import. Please split it into smaller sections.');

        const { data: existingRows, error: existingError } = await supabase
          .from('topics').select('id, name, parent_id, position').eq('subject_id', subject.id);
        if (existingError) return failed('I could not check existing Biology topics, so I stopped without adding anything.');

        const existing = existingRows ?? [];
        const rootByName = new Map(existing.filter((row) => !row.parent_id).map((row) => [row.name.trim().toLowerCase(), row]));
        let nextRootPosition = existing.filter((row) => !row.parent_id).reduce(
          (max, row) => Math.max(max, Number(row.position ?? -1)), -1
        ) + 1;
        const rootsToCreate = parsedTopics.filter((topic) => !rootByName.has(topic.name.toLowerCase()));
        let rootsCreated = 0;
        let childrenCreated = 0;

        if (rootsToCreate.length > 0) {
          const rootRows = rootsToCreate.map((topic) => ({
            subject_id: subject.id,
            parent_id: null,
            name: topic.name,
            description: 'AQA A-level Biology (7402) · Year ' + topic.year,
            position: nextRootPosition++,
            is_difficult: false,
          }));
          const { data: insertedRoots, error: rootInsertError } = await supabase
            .from('topics').insert(rootRows).select('id, name, parent_id, position');
          if (rootInsertError || !insertedRoots) {
            console.error('Bulk curriculum parent-topic insert failed:', rootInsertError);
            return failed('I could not save the main Biology topics. The database rejected the batch, so no subtopics were attempted.');
          }
          rootsCreated = insertedRoots.length;
          insertedRoots.forEach((row) => rootByName.set(row.name.trim().toLowerCase(), row));
        }

        const childRows: { subject_id: string; parent_id: string; name: string; description: string | null; position: number; is_difficult: boolean }[] = [];
        let skippedDuplicates = parsedTopics.length - rootsToCreate.length;
        for (const topic of parsedTopics) {
          const parent = rootByName.get(topic.name.toLowerCase());
          if (!parent) continue;
          const siblings = existing.filter((row) => row.parent_id === parent.id);
          const existingNames = new Set(siblings.map((row) => row.name.trim().toLowerCase()));
          let position = siblings.reduce((max, row) => Math.max(max, Number(row.position ?? -1)), -1) + 1;
          for (const subtopic of topic.subtopics) {
            if (existingNames.has(subtopic.toLowerCase())) {
              skippedDuplicates += 1;
              continue;
            }
            existingNames.add(subtopic.toLowerCase());
            childRows.push({
              subject_id: subject.id,
              parent_id: parent.id,
              name: subtopic,
              description: null,
              position: position++,
              is_difficult: false,
            });
          }
        }

        for (let offset = 0; offset < childRows.length; offset += 100) {
          const batch = childRows.slice(offset, offset + 100);
          const { data: insertedChildren, error: childInsertError } = await supabase
            .from('topics').insert(batch).select('id');
          if (childInsertError || !insertedChildren) {
            console.error('Bulk curriculum subtopic insert failed:', childInsertError);
            const { data: verifyAfterFailure } = await supabase
              .from('topics').select('name, parent_id').eq('subject_id', subject.id);
            const savedPairs = new Set((verifyAfterFailure ?? []).map((row) =>
              String(row.parent_id) + '::' + row.name.trim().toLowerCase()
            ));
            const confirmedChildren = childRows.filter((row) =>
              savedPairs.has(row.parent_id + '::' + row.name.trim().toLowerCase())
            ).length;
            return failed('Partially saved and verified: ' + rootsCreated + ' main topics and ' + confirmedChildren +
              ' subtopics are in the database. A later subtopic batch failed, so I stopped. Please refresh before retrying.');
          }
          childrenCreated += insertedChildren.length;
        }

        const { data: verifiedRows, error: verifyError } = await supabase
          .from('topics').select('id, name, parent_id').eq('subject_id', subject.id);
        if (verifyError || !verifiedRows) {
          return failed('The save requests completed, but I could not verify the final database contents. Please refresh before retrying.');
        }

        const verifiedRoots = new Map(verifiedRows.filter((row) => !row.parent_id).map((row) => [row.name.trim().toLowerCase(), row]));
        const missing: string[] = [];
        for (const topic of parsedTopics) {
          const parent = verifiedRoots.get(topic.name.toLowerCase());
          if (!parent) {
            missing.push(topic.name);
            continue;
          }
          const savedChildren = verifiedRows.filter((row) => row.parent_id === parent.id).map((row) => row.name.trim().toLowerCase());
          for (const child of topic.subtopics) {
            if (!savedChildren.includes(child.toLowerCase())) missing.push(topic.name + ' / ' + child);
          }
        }

        if (missing.length > 0) {
          return failed('Database verification found ' + missing.length + ' missing entries. The import is incomplete; first missing entry: ' + missing[0] + '.');
        }
        return {
          success: true,
          summary: 'Verified in the database: added ' + rootsCreated + ' main topics and ' + childrenCreated +
            ' subtopics to ' + subject.name + '. Existing entries were kept; duplicates were skipped (' + skippedDuplicates + ').',
        };
      }

      case 'create_subject': {
        const name = getText('name');
        if (!name) return failed('A subject name is required.');

        if (findSubject(name)) {
          return failed(`The subject "${name}" already exists.`);
        }

        const { data: created, error } = await supabase
          .from('subjects')
          .insert({
            user_id: userId,
            name,
            color: getText('color') || '#3b82f6',
            position: data.subjects.length,
          })
          .select('id, name')
          .single();

        if (error || !created) {
          return failed(`I couldn't create the subject "${name}".`);
        }

        return {
          success: true,
          summary: `Created the subject "${created.name}".`,
        };
      }

      case 'create_topic': {
        const name = getText('name') || getText('topic_name') || getText('title');
        const subjectName = getText('subject_name') || getText('subject');

        if (!name || !subjectName) {
          return failed('A topic name and subject name are required. No topic was added.');
        }

        const { data: subjectRows, error: subjectError } = await supabase
          .from('subjects')
          .select('id, name')
          .eq('user_id', userId);

        if (subjectError) {
          console.error('Could not load subjects for topic creation:', subjectError);
          return failed('I could not check your subjects, so I did not add the topic. Please try again.');
        }

        const subject = (subjectRows ?? []).find(
          (item) => item.name.trim().toLowerCase() === subjectName.toLowerCase()
        );
        if (!subject) {
          return failed('I could not find the subject "' + subjectName + '". No topic was added.');
        }

        const { data: existingTopics, error: topicsError } = await supabase
          .from('topics')
          .select('id, name, position')
          .eq('subject_id', subject.id);

        if (topicsError) {
          console.error('Could not check existing topics:', topicsError);
          return failed('I could not check existing topics in ' + subject.name + ', so I did not add anything.');
        }

        if ((existingTopics ?? []).some(
          (topic) => topic.name.trim().toLowerCase() === name.toLowerCase()
        )) {
          return failed('The topic "' + name + '" already exists in ' + subject.name + '. I did not create a duplicate.');
        }

        const nextPosition = (existingTopics ?? []).reduce(
          (highest, topic) => Math.max(highest, Number(topic.position ?? -1)),
          -1
        ) + 1;

        const { data: created, error } = await supabase
          .from('topics')
          .insert({
            subject_id: subject.id,
            name,
            description: getText('description') || null,
            parent_id: null,
            position: nextPosition,
            is_difficult: false,
          })
          .select('id, name')
          .single();

        if (error || !created) {
          console.error('Topic creation failed:', error);
          return failed('I could not save "' + name + '" in ' + subject.name + '. No topic was added.');
        }

        return {
          success: true,
          summary: 'Added "' + created.name + '" to ' + subject.name + '.',
        };
      }
      case 'create_subtopics_bulk': {
        const subjectName = getText('subject_name');
        const parentName = getText('parent_topic_name');
        const rawNames = p.subtopics;
        if (!subjectName || !parentName || !Array.isArray(rawNames)) {
          return failed('A subject, parent topic and list of subtopics are required. No changes were made.');
        }
        const names = [...new Set(rawNames.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean))];
        if (names.length === 0 || names.length > 30) return failed('Please provide between 1 and 30 valid subtopic names. No changes were made.');
        const { data: subjectRows, error: subjectError } = await supabase.from('subjects').select('id, name').eq('user_id', userId);
        if (subjectError) return failed('I could not load your subjects, so no subtopics were added.');
        const subject = (subjectRows ?? []).find((row) => row.name.trim().toLowerCase() === subjectName.toLowerCase());
        if (!subject) return failed('I could not find the subject "' + subjectName + '". No subtopics were added.');
        const { data: parentRows, error: parentError } = await supabase.from('topics').select('id, name, parent_id, position').eq('subject_id', subject.id);
        if (parentError) return failed('I could not check the parent topic, so no subtopics were added.');
        const parents = (parentRows ?? []).filter((row) => !row.parent_id && row.name.trim().toLowerCase() === parentName.toLowerCase());
        if (parents.length !== 1) return failed(parents.length === 0 ? 'I could not find the parent topic "' + parentName + '" in ' + subject.name + '. No subtopics were added.' : 'There is more than one matching parent topic. No subtopics were added.');
        const parent = parents[0];
        const siblings = (parentRows ?? []).filter((row) => row.parent_id === parent.id);
        const existingNames = new Set(siblings.map((row) => row.name.trim().toLowerCase()));
        const toInsert = names.filter((name) => !existingNames.has(name.toLowerCase()));
        if (toInsert.length === 0) return failed('Those subtopics already exist under "' + parent.name + '". No changes were made.');
        let position = siblings.reduce((max, row) => Math.max(max, Number(row.position ?? -1)), -1) + 1;
        const rows = toInsert.map((name) => ({ subject_id: subject.id, parent_id: parent.id, name, description: null, position: position++, is_difficult: false }));
        const { error: insertError } = await supabase.from('topics').insert(rows);
        if (insertError) {
          console.error('Multiple subtopic insert failed:', insertError);
          return failed('I could not save the subtopics under "' + parent.name + '". No success was reported.');
        }
        const { data: verifiedRows, error: verifyError } = await supabase.from('topics').select('name, parent_id').eq('subject_id', subject.id).eq('parent_id', parent.id);
        if (verifyError || !verifiedRows) return failed('The save request completed, but I could not verify the subtopics. Please refresh before retrying.');
        const verified = new Set(verifiedRows.map((row) => row.name.trim().toLowerCase()));
        const confirmed = toInsert.filter((name) => verified.has(name.toLowerCase()));
        if (confirmed.length !== toInsert.length) return failed('Only ' + confirmed.length + ' of ' + toInsert.length + ' requested subtopics could be verified under "' + parent.name + '". Please refresh before retrying.');
        return { success: true, summary: 'Added and verified ' + confirmed.length + ' subtopics under "' + parent.name + '" in ' + subject.name + ': ' + confirmed.join(', ') + '.' };
      }
      case 'create_subtopic': {
        const name = getText('name');
        const parentName = getText('parent_topic_name') || getText('parent_topic');
        const subjectName = getText('subject_name') || getText('subject');
        if (!name || !parentName) return failed('A subtopic name and parent topic are required.');
        const { data: subjectRows, error: subjectError } = await supabase
          .from('subjects').select('id, name').eq('user_id', userId);
        if (subjectError) return failed('I could not load your subjects, so no subtopic was added.');
        const subject = (subjectRows ?? []).find(s =>
          !subjectName || s.name.trim().toLowerCase() === subjectName.toLowerCase()
        );
        if (!subject) return failed(subjectName
          ? 'I could not find the subject "' + subjectName + '". No subtopic was added.'
          : 'Please specify which subject contains the parent topic.');
        const { data: parent, error: parentError } = await supabase
          .from('topics').select('id, name, position').eq('subject_id', subject.id);
        if (parentError) return failed('I could not check the parent topic, so no subtopic was added.');
        const parentMatches = (parent ?? []).filter(t => t.name.trim().toLowerCase() === parentName.toLowerCase());
        if (parentMatches.length === 0) return failed('I could not find the parent topic "' + parentName + '" in ' + subject.name + '.');
        if (parentMatches.length > 1) return failed('There is more than one topic called "' + parentName + '" in ' + subject.name + '. Please specify which one.');
        const parentTopic = parentMatches[0];
        const { data: siblings, error: siblingsError } = await supabase
          .from('topics').select('id, name, position').eq('subject_id', subject.id).eq('parent_id', parentTopic.id);
        if (siblingsError) return failed('I could not check existing subtopics, so nothing was added.');
        if ((siblings ?? []).some(t => t.name.trim().toLowerCase() === name.toLowerCase()))
          return failed('The subtopic "' + name + '" already exists under ' + parentTopic.name + '.');
        const position = (siblings ?? []).reduce((max, t) => Math.max(max, Number(t.position ?? -1)), -1) + 1;
        const { data: created, error } = await supabase.from('topics').insert({
          subject_id: subject.id, parent_id: parentTopic.id, name,
          description: getText('description') || null, position, is_difficult: false,
        }).select('id, name').single();
        if (error || !created) {
          console.error('Subtopic creation failed:', error);
          return failed('I could not save "' + name + '" under ' + parentTopic.name + '. No subtopic was added.');
        }
        return { success: true, summary: 'Added subtopic "' + created.name + '" under "' + parentTopic.name + '" in ' + subject.name + '.' };
      }
      case 'create_task': {
        const title = getText('title');
        if (!title) return failed('A task title is required.');

        const subjectName = getText('subject_name');
        const subject = subjectName ? findSubject(subjectName) : null;

        if (subjectName && !subject) {
          return failed(`I couldn't find the subject "${subjectName}".`);
        }

        const requestedPriority = getText('priority');
        const priority = ['low', 'medium', 'high', 'urgent'].includes(
          requestedPriority
        )
          ? requestedPriority
          : 'medium';

        const { data: created, error } = await supabase
          .from('tasks')
          .insert({
            user_id: userId,
            title,
            description: getText('description') || null,
            subject_id: subject?.id ?? null,
            project_id: null,
            status: 'todo',
            priority,
            deadline: getText('deadline') || null,
            position: 0,
          })
          .select('id, title')
          .single();

        if (error || !created) {
          return failed(`I couldn't create the task "${title}".`);
        }

        return {
          success: true,
          summary: `Created the task "${created.title}".`,
        };
      }

      case 'create_note': {
        const title = getText('title');
        if (!title) return failed('A note title is required.');

        const subjectName = getText('subject_name');
        const subject = subjectName ? findSubject(subjectName) : null;

        if (subjectName && !subject) {
          return failed(`I couldn't find the subject "${subjectName}".`);
        }

        const topicName = getText('topic_name');
        let topicId: string | null = null;

        if (topicName) {
          if (!subject) {
            return failed('I need the subject name to attach this note to a topic.');
          }

          const topic = findTopic(topicName, subject.id);
          if (!topic) {
            return failed(`I couldn't find the topic "${topicName}" in ${subject.name}.`);
          }

          topicId = topic.id;
        }

        const { data: created, error } = await supabase
          .from('notes')
          .insert({
            user_id: userId,
            title,
            content: getText('content'),
            subject_id: subject?.id ?? null,
            topic_id: topicId,
          })
          .select('id, title')
          .single();

        if (error || !created) {
          return failed(`I couldn't create the note "${title}".`);
        }

        return {
          success: true,
          summary: `Created the note "${created.title}".`,
        };
      }

      case 'create_study_session': {
        const title = getText('title');
        const subjectName = getText('subject_name');

        if (!title || !subjectName) {
          return failed('A session title and subject name are required.');
        }

        const subject = findSubject(subjectName);
        if (!subject) {
          return failed(`I couldn't find the subject "${subjectName}".`);
        }

        const topicName = getText('topic_name');
        let topicId: string | null = null;

        if (topicName) {
          const topic = findTopic(topicName, subject.id);
          if (!topic) {
            return failed(`I couldn't find the topic "${topicName}" in ${subject.name}.`);
          }
          topicId = topic.id;
        }

        const duration = Number(p.duration_minutes ?? 60);
        const confidence = Number(p.confidence ?? 3);

        if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
          return failed('The session duration must be between 1 and 1440 minutes.');
        }

        if (!Number.isInteger(confidence) || confidence < 1 || confidence > 5) {
          return failed('Confidence must be a number from 1 to 5.');
        }

        const { data: created, error } = await supabase
          .from('study_sessions')
          .insert({
            user_id: userId,
            subject_id: subject.id,
            topic_id: topicId,
            title,
            studied_date: getText('studied_date') || new Date().toISOString().slice(0, 10),
            duration_minutes: duration,
            confidence,
          })
          .select('id, title')
          .single();

        if (error || !created) {
          return failed(`I couldn't create the study session "${title}".`);
        }

        return {
          success: true,
          summary: `Created the study session "${created.title}".`,
        };
      }

      case 'create_flashcard': {
        const front = getText('front');
        const back = getText('back');

        if (!front || !back) {
          return failed('A flashcard needs both a question and an answer.');
        }

        const subjectName = getText('subject_name');
        const subject = subjectName ? findSubject(subjectName) : null;

        if (subjectName && !subject) {
          return failed(`I couldn't find the subject "${subjectName}".`);
        }

        const topicName = getText('topic_name');
        let topicId: string | null = null;

        if (topicName) {
          if (!subject) {
            return failed('I need the subject name to attach this flashcard to a topic.');
          }

          const topic = findTopic(topicName, subject.id);
          if (!topic) {
            return failed(`I couldn't find the topic "${topicName}" in ${subject.name}.`);
          }

          topicId = topic.id;
        }

        const { data: created, error } = await supabase
          .from('flashcards')
          .insert({
            user_id: userId,
            subject_id: subject?.id ?? null,
            topic_id: topicId,
            front,
            back,
          })
          .select('id')
          .single();

        if (error || !created) {
          return failed("I couldn't create that flashcard.");
        }

        return {
          success: true,
          summary: 'Created a flashcard.',
        };
      }

      default:
        return failed(`I don't support the action "${action.type}" yet.`);
    }
  } catch {
    return failed('Something went wrong while carrying out that action.');
  }
}

