import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useUserData } from '@/hooks/useUserData';
import { agentTurn, AiError } from '@/lib/aiClient';
import {
  X, Send, Bot, Sparkles, Loader2, Maximize2, Minimize2,
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
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
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
        content: "Hi! I'm Study AI. Ask me anything — I can explain concepts, help with homework, answer general questions, and I know what's in your StudyTrack account so I can help you plan.\n\nTry \"What should I revise today?\", \"Explain photosynthesis simply\" or \"Add a Biology study session about mitosis\".",
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
      // Handle clear topic-creation requests directly so they do not depend on
      // the model inventing the exact action name and payload keys.
      const topicRequest = extractCreateTopicRequest(userMessage, data.subjects);
      if (topicRequest) {
        const execution = await executeAgentAction(
          { type: 'create_topic', payload: topicRequest },
          data,
          user!.id
        );
        response = execution.summary;
        if (execution.success) {
          action = execution.summary;
        }
        // Refresh every mounted data view even when the topic already existed,
        // so a previously stale Subjects page catches up as well.
        await data.refresh();
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
          response = result.message;
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

  const panelSize = fullscreen
    ? 'fixed inset-0 z-50 w-full h-full'
    : 'fixed top-0 right-0 h-full w-full sm:w-[440px] z-50';

  return (
    <>
      {/* Backdrop */}
      {open && !fullscreen && <div className="fixed inset-0 bg-black/30 z-40 lg:bg-black/20" onClick={onClose} />}

      {/* Panel */}
      <div
        className={`${panelSize} flex flex-col surface border-l border-app transition-all duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        } ${fullscreen ? 'opacity-100' : ''}`}
        style={fullscreen ? { transform: open ? 'none' : 'translateX(100%)' } : undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-app shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, var(--accent-secondary), var(--accent))' }}>
              <Bot size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-primary">Study AI</h3>
              <p className="text-xs text-tertiary">{fullscreen ? 'Full screen' : 'Your study assistant'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={startNewChat} title="Start a new chat" className="btn-ghost btn !p-2">
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => setFullscreen((f) => !f)}
              title={fullscreen ? 'Exit full screen' : 'Full screen'}
              className="btn-ghost btn !p-2"
            >
              {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button onClick={onClose} className="btn-ghost btn !p-2">
              <X size={18} />
            </button>
          </div>
        </div>

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
              className="input min-h-[44px] max-h-32 resize-none"
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
    lines.push(`Topics studied recently: ${data.topics.slice(0, 10).map((t) => `${t.name} (${data.subjects.find((s) => s.id === t.subject_id)?.name ?? '?'})`).join(', ')}.`);
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

function extractCreateTopicRequest(
  message: string,
  subjects: { name: string }[]
): { name: string; subject_name: string } | null {
  const patterns = [
    /^(?:please\s+|can you\s+|could you\s+|would you\s+)*(?:add|create|make)\s+(?:a\s+|new\s+)?topic\s+(?:called|named)\s+(.+?)\s+(?:to|in|under|for)\s+(.+?)(?:\s+please)?[.!?]*$/i,
    /^(?:please\s+|can you\s+|could you\s+|would you\s+)*(?:add|create|make)\s+(?:a\s+|new\s+)?topic\s+(.+?)\s+(?:to|in|under|for)\s+(.+?)(?:\s+please)?[.!?]*$/i,
    /^(?:please\s+|can you\s+|could you\s+|would you\s+)*(?:add|create|make)\s+(.+?)\s+as\s+a\s+topic\s+(?:to|in|under|for)\s+(.+?)(?:\s+please)?[.!?]*$/i,
  ];

  for (const pattern of patterns) {
    const match = message.trim().match(pattern);
    if (!match) continue;

    const clean = (value: string) =>
      value.trim().replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '').replace(/[.!?]+$/, '').trim();
    const name = clean(match[1]);
    const requestedSubject = clean(match[2]);
    if (!name || !requestedSubject) continue;

    const subject = subjects.find(
      (item) => item.name.trim().toLowerCase() === requestedSubject.toLowerCase()
    );
    return { name, subject_name: subject?.name ?? requestedSubject };
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

