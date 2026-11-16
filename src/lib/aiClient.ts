import { supabase } from '@/lib/supabase';

export type AiCard = { front: string; back: string };

export type YoutubeResult = {
  summary: string;
  key_points: string[];
  key_terms: { term: string; definition: string }[];
  notes: string;
};

type AiResponse = { text?: string; source_url?: string | null; error?: string };

export class AiError extends Error {}

async function callAi(body: Record<string, unknown>): Promise<AiResponse> {
  const { data, error } = await supabase.functions.invoke<AiResponse>('ai-generate', { body });
  if (error) {
    // functions.invoke surfaces HTTP error bodies through context in some versions;
    // try to recover the friendly message from it.
    const ctx = (error as { context?: { json?: () => Promise<AiResponse> } }).context;
    if (ctx?.json) {
      const payload = await ctx.json();
      if (payload?.error) throw new AiError(payload.error);
    }
    throw new AiError('Could not reach the AI service. Check your connection and try again.');
  }
  if (data?.error) throw new AiError(data.error);
  return data ?? {};
}

function extractJson<T>(text: string): T {
  const fencedBlocks = [...text.matchAll(/\x60{3}(?:json)?\s*([\s\S]*?)\x60{3}/gi)].map((match) => match[1]);
  const candidates = [...fencedBlocks, text];

  for (const candidate of candidates) {
    for (let start = 0; start < candidate.length; start += 1) {
      const opening = candidate[start];
      if (opening !== '{' && opening !== '[') continue;

      const stack: string[] = [];
      let inString = false;
      let escaped = false;

      for (let end = start; end < candidate.length; end += 1) {
        const char = candidate[end];
        if (inString) {
          if (escaped) escaped = false;
          else if (char === '\\') escaped = true;
          else if (char === '"') inString = false;
          continue;
        }
        if (char === '"') {
          inString = true;
          continue;
        }
        if (char === '{' || char === '[') stack.push(char);
        if (char === '}' || char === ']') {
          const expected = char === '}' ? '{' : '[';
          if (stack.pop() !== expected) break;
          if (stack.length === 0) {
            try {
              return JSON.parse(candidate.slice(start, end + 1)) as T;
            } catch {
              break;
            }
          }
        }
      }
    }
  }

  throw new AiError('The AI response could not be read in the expected format. Please try again or use a smaller amount of material.');
}

export async function generateFlashcards(opts: {
  material: string;
  subject?: string;
  topic?: string;
  count?: number;
  style?: string;
}): Promise<AiCard[]> {
  const { text } = await callAi({
    task: 'flashcards',
    material: opts.material,
    subject: opts.subject,
    topic: opts.topic,
    count: opts.count ?? 8,
    options: { cardStyle: opts.style },
  });
  const parsed = extractJson<{ cards?: AiCard[] }>(text ?? '');
  if (!parsed.cards?.length) throw new AiError('The AI could not generate cards from that material.');
  return parsed.cards;
}

export async function extractMaterial(opts: {
  material: string;
  sourceType: string;
  subject?: string;
  topic?: string;
}): Promise<{ title: string; content: string }> {
  const { text } = await callAi({
    task: 'import',
    material: opts.material,
    subject: opts.subject,
    topic: opts.topic,
    options: { sourceType: opts.sourceType },
  });
  return extractJson<{ title: string; content: string }>(text ?? '');
}

export async function summarizeYoutube(url: string, subject?: string, topic?: string): Promise<YoutubeResult> {
  const { text } = await callAi({
    task: 'youtube',
    subject,
    topic,
    options: { url },
  });
  return extractJson<YoutubeResult>(text ?? '');
}

export type QuizQuestion = {
  type: 'mcq' | 'short' | 'truefalse' | 'fill_blank';
  question: string;
  options?: string[];
  answer: string;
  explanation?: string;
};

export async function generateNotes(opts: {
  material: string;
  style: string;
  subject?: string;
  topic?: string;
}): Promise<{ title: string; content: string }> {
  const { text } = await callAi({
    task: 'notes',
    material: opts.material,
    subject: opts.subject,
    topic: opts.topic,
    options: { style: opts.style },
  });
  return extractJson<{ title: string; content: string }>(text ?? '');
}

export async function generateQuiz(opts: {
  material: string;
  questionType: string;
  count: number;
  subject?: string;
  topic?: string;
}): Promise<QuizQuestion[]> {
  const { text } = await callAi({
    task: 'quiz',
    material: opts.material,
    subject: opts.subject,
    topic: opts.topic,
    count: opts.count,
    options: { questionType: opts.questionType },
  });
  const parsed = extractJson<{ questions?: QuizQuestion[] }>(text ?? '');
  if (!parsed.questions?.length) throw new AiError('The AI could not generate questions from that material.');
  return parsed.questions;
}

export async function chatTurn(opts: {
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  context?: string;
}): Promise<string> {
  const { text } = await callAi({
    task: 'chat',
    messages: [
      ...opts.history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: opts.message },
    ],
    options: opts.context ? { context: opts.context } : undefined,
  });
  return text ?? '';
}

export type AgentAction = {
  type: string;
  payload: Record<string, unknown>;
};

export type AgentTurnResult = {
  message: string;
  actions: AgentAction[];
};

export async function agentTurn(opts: {
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  context?: string;
}): Promise<AgentTurnResult> {
  const { text } = await callAi({
    task: 'agent',
    messages: [
      ...opts.history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: opts.message },
    ],
    options: opts.context ? { context: opts.context } : undefined,
  });

  const raw = (text ?? '').trim();
  let parsed: AgentTurnResult;

  try {
    parsed = extractJson<AgentTurnResult>(raw);
  } catch (error) {
    // A conversational answer needs no action payload. Display it rather than
    // rejecting the turn when a provider ignores JSON mode.
    const fencePrefix = String.fromCharCode(96, 96, 96) + 'json';
    const startsWithStructuredOutput = raw.startsWith('{') || raw.startsWith('[') || raw.startsWith(fencePrefix);
    if (raw && !startsWithStructuredOutput) {
      return { message: raw, actions: [] };
    }
    throw error;
  }

  if (typeof parsed.message !== 'string' || !Array.isArray(parsed.actions)) {
    throw new AiError('The AI response was missing its message or actions. Please try again.');
  }

  return parsed;
}

export async function tutorTurn(opts: {
  sessionId: string;
  subject: string;
  topic: string;
  level: string;
  material?: string;
  history: { role: 'tutor' | 'student'; content: string }[];
  stage: 'teach' | 'final_test';
  studentMessage?: string;
}): Promise<string> {
  const { text } = await callAi({
    task: opts.stage === 'final_test' ? 'tutor_test' : 'tutor',
    subject: opts.subject,
    topic: opts.topic,
    level: opts.level,
    material: opts.material,
    messages: [
      ...opts.history.map((m) => ({
        role: m.role === 'tutor' ? ('assistant' as const) : ('user' as const),
        content: m.content,
      })),
      ...(opts.studentMessage ? [{ role: 'user' as const, content: opts.studentMessage }] : []),
    ],
    options: { sessionId: opts.sessionId },
  });
  return text ?? '';
}
