// Secure AI proxy for StudyTrack. The provider API key lives only in a
// server-side secret — never in frontend code. Supports Groq
// (AI_API_KEY / GROQ_API_KEY) and OpenAI (OPENAI_API_KEY); both use an
// OpenAI-compatible chat completions endpoint.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type RequestBody = {
  task: string;
  messages?: ChatMessage[];
  material?: string;
  subject?: string;
  topic?: string;
  level?: string;
  count?: number;
  options?: Record<string, unknown>;
};

// Per-user AI preferences, applied to every generation task so tone and depth
// follow the student's settings.
async function loadUserPrefs(supabase: ReturnType<typeof createClient>, userId: string): Promise<{ tone: string; depth: string }> {
  const { data } = await supabase
    .from('profiles')
    .select('ai_tone, ai_depth')
    .eq('id', userId)
    .maybeSingle();
  return {
    tone: (data?.ai_tone as string) ?? 'friendly',
    depth: (data?.ai_depth as string) ?? 'balanced',
  };
}

const SYSTEM_PROMPTS: Record<string, string> = {
  flashcards:
    "You generate study flashcards from educational material. Respond ONLY with valid JSON: {\"cards\":[{\"front\":\"...\",\"back\":\"...\"}]}. Cards must test genuine understanding: mix definitions, explanations and application questions. Never invent facts not present in the material.",
  import:
    "You extract educational content from imported material (typed notes, pasted text, transcripts or OCR text from documents/images). Produce a cleaned, structured plain-text digest of the key educational content: definitions, facts, processes, examples. Respond ONLY with valid JSON: {\"title\":\"...\",\"content\":\"...\"}.",
  youtube:
    "You summarise educational YouTube videos from their transcripts. Produce: a concise summary, key points as a bulleted list, key terms with definitions, and study notes. Respond ONLY with valid JSON: {\"summary\":\"...\",\"key_points\":[\"...\"],\"key_terms\":[{\"term\":\"...\",\"definition\":\"...\"}],\"notes\":\"...\"}. Use ONLY what the transcript says — do not add outside information.",
  notes:
    "You generate study notes in the requested style from educational material. Styles: detailed (thorough structured notes), simplified (plain-language, jargon-free), exam (condensed, mark-scheme focused), summary (short overview), definitions (key terms with definitions), steps (step-by-step explanations). Respond ONLY with valid JSON: {\"title\":\"...\",\"content\":\"...\"} where content is markdown-formatted notes. Never invent facts not supported by the material.",
  quiz:
    "You generate study quizzes from educational material. Question types: mcq (exactly 4 options), short (short written answer), truefalse, fill_blank (sentence with ___ for the blank). The requested type is passed as options.questionType — generate only that type unless it is 'mixed'. Respond ONLY with valid JSON: {\"questions\":[{\"type\":\"mcq\",\"question\":\"...\",\"options\":[\"...\",\"...\",\"...\",\"...\"],\"answer\":\"...\",\"explanation\":\"...\"}]}. For truefalse the answer must be exactly \"True\" or \"False\". For fill_blank the answer is the missing word or phrase. For short answers, keep the model answer brief so grading is fair. Never invent facts not supported by the material.",
  tutor:
    "You are StudyTrack's Interactive Tutor. You teach a student one concept at a time following this loop: briefly introduce the concept, explain it clearly in small steps, then ask ONE checking question and STOP, waiting for the student's answer. If they answer wrongly or incompletely, correct the misunderstanding kindly and re-explain with a different example before moving on. Never dump long multi-concept explanations. Adjust depth to the requested level (beginner, intermediate, advanced, exam). Use the student's own material as the basis. Keep responses under 200 words.",
  chat:
    "You are Nova, the assistant inside the StudyTrack study app. You can answer ANY question helpfully and accurately — general knowledge, homework help, explanations, study skills, planning, writing, or casual conversation. Give direct, correct answers first, then brief supporting detail. Use plain text with short paragraphs and bullet points where useful. Keep answers focused; expand only if asked. When the student's app context is provided, use it to personalise study advice.",
  agent:
    `You are Nova, StudyTrack's AI agent. You can answer questions and request changes to the student's StudyTrack account.

Return ONLY valid JSON in this exact format:
{
  "message": "A short response to the student",
  "actions": []
}

ACTION RULES:
- If the student clearly asks you to create or add something that is supported below, you MUST return the matching action.
- Use only the exact action names and payload field names listed below. Do not invent action names.
- Do not say that anything was added, created, saved, updated, or deleted. The website will report the actual result after it executes the action.
- If the student is only asking a question or asking how to do something, return an empty actions array.
- If essential information is missing, ask for it and return an empty actions array.
- Never invent subject names, topic names, IDs, or existing app data. Use the supplied app context.

SUPPORTED ACTIONS:

1. Create a subject:
{
  "type": "create_subject",
  "payload": { "name": "Biology", "color": "#3b82f6" }
}

2. Create a topic inside an existing subject:
{
  "type": "create_topic",
  "payload": {
    "name": "Photosynthesis",
    "subject_name": "Biology",
    "description": ""
  }
}
Use this exact action when the student asks to add or create a topic. The subject_name must match one of the subjects in the supplied app context.

3. Create a subtopic under an existing parent topic:
{
  "type": "create_subtopic",
  "payload": {
    "name": "Light-dependent reaction",
    "parent_topic_name": "Photosynthesis",
    "subject_name": "Biology",
    "description": ""
  }
}
Use this exact action when the student asks to add a subtopic. The parent topic must already exist. Never create it as a top-level topic.

4. Create multiple topics and subtopics in one verified curriculum import:
{
  "type": "create_topics_bulk",
  "payload": {
    "subject_name": "Biology",
    "topics": [
      {
        "name": "Biological molecules",
        "year": 12,
        "subtopics": ["Monomers and polymers", "Carbohydrates", "Lipids"]
      }
    ]
  }
}
Use this action when the student asks to add a whole curriculum, syllabus, or multiple topics at once. Generate the complete requested list as nested parent topics and subtopics. Use the official named specification when the exam board and qualification are supplied. Do not include required practicals, experiments, or practical activities when the student says to exclude them. Do not split subtopics into separate top-level topics. Keep the list to at most 30 parent topics and 600 subtopics. Never say it was saved; the website will insert and verify the rows.

5. Create a task:
{
  "type": "create_task",
  "payload": {
    "title": "Revise photosynthesis",
    "description": "",
    "subject_name": "Biology",
    "priority": "medium",
    "deadline": ""
  }
}

4. Create a note:
{
  "type": "create_note",
  "payload": {
    "title": "Photosynthesis",
    "content": "Note content",
    "subject_name": "Biology",
    "topic_name": "Photosynthesis"
  }
}

6. Log a study session:
{
  "type": "create_study_session",
  "payload": {
    "title": "Revised photosynthesis",
    "subject_name": "Biology",
    "topic_name": "Photosynthesis",
    "duration_minutes": 30,
    "confidence": 3,
    "studied_date": "YYYY-MM-DD"
  }
}

7. Create a flashcard:
{
  "type": "create_flashcard",
  "payload": {
    "front": "What is photosynthesis?",
    "back": "A process plants use to make glucose.",
    "subject_name": "Biology",
    "topic_name": "Photosynthesis"
  }
}

When one or more actions are requested, use the message only for brief context or clarification. Never write a success confirmation yourself.`,
  tutor_test:
    "You are StudyTrack's Interactive Tutor running a final knowledge test. Ask one question at a time covering the lesson's concepts. After each answer, mark it, give brief feedback, then continue. After the last question give a score out of total and a one-line summary of weak areas. Respond in plain text.",
};

function buildUserPrompt(body: RequestBody): string {
  const parts: string[] = [];
  const ctx = body.options?.context;
  if (typeof ctx === "string" && ctx) parts.push(`Student's app context:\n${ctx.slice(0, 4000)}`);
  if (body.subject) parts.push(`Subject: ${body.subject}`);
  if (body.topic) parts.push(`Topic: ${body.topic}`);
  if (body.level) parts.push(`Explanation level: ${body.level}`);
  if (body.task === "flashcards") parts.push(`Generate ${body.count ?? 8} flashcards.`);
  if (body.material) parts.push(`Material:\n${body.material.slice(0, 12000)}`);
  return parts.join("\n");
}

// Fetches the caption/transcript for a YouTube video. Returns null when no
// captions exist or YouTube blocks access — the caller must show an honest
// limitation message rather than inventing a summary.
async function fetchYoutubeTranscript(url: string): Promise<string | null> {
  const match = url.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
  if (!match) return null;
  const videoId = match[1];

  const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept-Language": "en" },
  });
  if (!watchRes.ok) return null;
  const html = await watchRes.text();

  const tracksMatch = html.match(/"captionTracks":\s*(\[[^\]]+\])/);
  if (!tracksMatch) return null;
  let baseUrl: string | null = null;
  try {
    const tracks = JSON.parse(tracksMatch[1].replace(/\\u0026/g, "&")) as { baseUrl?: string; languageCode?: string }[];
    const en = tracks.find((t) => t.languageCode?.startsWith("en")) ?? tracks[0];
    baseUrl = en?.baseUrl?.replace(/\\u0026/g, "&") ?? null;
  } catch {
    return null;
  }
  if (!baseUrl) return null;

  const capRes = await fetch(`${baseUrl}&fmt=json3`);
  if (!capRes.ok) return null;
  const capData = await capRes.json();
  const segs = capData?.events?.flatMap((e: { segs?: { utf8?: string }[] }) =>
    (e.segs ?? []).map((s) => s.utf8 ?? "")
  ).join("") ?? "";
  const cleaned = segs.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > 40 ? cleaned : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check every secret the key could have been saved under. Groq keys start
    // with "gsk_", OpenAI keys with "sk-" — detect the provider from the key
    // itself so either works regardless of the secret's name.
    const candidateKeys = [
      Deno.env.get("AI_API_KEY"),
      Deno.env.get("GROQ_API_KEY"),
      Deno.env.get("OPENAI_API_KEY"),
      Deno.env.get("BoltWebsiteStudyTrackers"),
    ].filter((k): k is string => !!k && k.length > 20);

    const provider = candidateKeys
      .map((key) =>
        key.startsWith("sk-") && !key.includes("gsk")
          ? { key, url: "https://api.openai.com/v1/chat/completions", models: ["gpt-4o-mini"], label: "OpenAI" }
          : { key, url: "https://api.groq.com/openai/v1/chat/completions", models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.1-8b-instant"], label: "Groq" }
      )[0] ?? null;
    if (!provider) {
      return new Response(
        JSON.stringify({ error: "The AI service is not configured yet. Add your API key as the AI_API_KEY secret (Groq or OpenAI both work), then try again." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();

    // YouTube tasks: pull the real transcript first, never fabricate one.
    let material = body.material ?? "";
    let sourceUrl: string | null = null;
    if (body.task === "youtube") {
      const url = typeof body.options?.url === "string" ? body.options.url : "";
      const transcript = await fetchYoutubeTranscript(url);
      sourceUrl = url || null;
      if (!transcript) {
        return new Response(
          JSON.stringify({
            error: "No transcript could be accessed for this video. It may have captions disabled, be age-restricted, or YouTube may be blocking automated access. Try pasting the video's key content as text instead.",
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      material = `YouTube transcript (source: ${url}):\n${transcript}`;
    }

    const systemPrompt = SYSTEM_PROMPTS[body.task] ?? SYSTEM_PROMPTS.tutor;
    const prefs = await loadUserPrefs(supabase, userData.user.id);
    const styleDirective = `\n\nStyle: use a ${prefs.tone} tone and ${prefs.depth} depth of explanation.`;
    const appContext = typeof body.options?.context === "string"
      ? body.options.context.slice(0, 4000)
      : "";
    const identityDirective = "You are Nova, the named AI study companion built into StudyTrack. Your name is Nova. If asked your name, say Nova. Speak naturally in first person as Nova, and do not call yourself Study AI or a generic assistant.\\n\\n";
    const systemContent = identityDirective + systemPrompt + styleDirective +
      (body.task === "agent" && appContext
        ? `\n\nStudent's app context:\n${appContext}`
        : "");
    const requestMessages = body.messages ?? [];
    // Agent requests already include the current user message in requestMessages.
    // Keep app context in the system instructions instead of appending it as
    // another user turn, which could distract the model from the actual request.
    const extraPrompt = body.task === "agent"
      ? (requestMessages.length === 0 ? "Begin the lesson." : null)
      : (buildUserPrompt({ ...body, material }) || (requestMessages.length === 0 ? "Begin the lesson." : null));
    const messages: ChatMessage[] = [
      { role: "system", content: systemContent },
      ...requestMessages,
      ...(extraPrompt ? [{ role: "user" as const, content: extraPrompt }] : []),
    ];

    const temperature = body.task === "tutor" || body.task === "tutor_test" ? 0.6 : 0.4;

    // Try each model in the provider's list in order — handles model
    // deprecations and account-tier restrictions without a redeploy.
    let text = "";
    let lastError = "The AI service returned an error. Please try again in a moment.";
    for (const model of provider.models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const providerRes = await fetch(provider.url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${provider.key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: body.task === "agent" ? 7000 : 2400,
            ...(provider.label === "Groq" && model.startsWith("openai/gpt-oss-")
              ? { reasoning_effort: "low" }
              : {}),
            ...(["agent", "flashcards", "import", "youtube", "notes", "quiz"].includes(body.task)
              ? { response_format: { type: "json_object" } }
              : {}),
          }),
        });

        if (providerRes.ok) {
          const providerData = await providerRes.json();
          const choice = providerData.choices?.[0];
          const messageContent = choice?.message?.content;
          text = typeof messageContent === "string"
            ? messageContent.trim()
            : Array.isArray(messageContent)
              ? messageContent.map((part: { text?: string }) => part?.text ?? "").join("").trim()
              : "";
          if (!text && choice?.finish_reason === "length") {
            lastError = "The AI response ran out of space. Please try a shorter request.";
          }
          break;
        }

        const errText = await providerRes.text();
        console.error("AI provider error:", providerRes.status, model, errText);

        let detail = "";
        try {
          detail = JSON.parse(errText)?.error?.message ?? "";
        } catch {
          detail = errText.slice(0, 300);
        }
        if (providerRes.status === 401) {
          lastError = `The AI service rejected its API key. Check that the ${provider.label} API key saved in the app's secrets is valid and active.`;
        } else if (providerRes.status === 429) {
          lastError = detail.includes("quota")
            ? `The ${provider.label} account behind the app's AI key has hit its usage limit. Check the account's plan or rate limits, then try again.`
            : "The AI service is busy right now. Please try again in a moment.";
        } else {
          lastError = `The AI service returned an error (code ${providerRes.status}). ${detail || "Please try again in a moment."}`;
        }

        // 404 means this model isn't available to the account — try the next
        // model instead of retrying the same one.
        const retryable = providerRes.status === 429 || providerRes.status >= 500;
        if (providerRes.status === 404) break;
        if (!retryable || attempt === 1) break;
        await new Promise((r) => setTimeout(r, 800));
      }
      if (text) break;
    }

    if (!text) {
      return new Response(JSON.stringify({ error: lastError }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ text, source_url: sourceUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-generate error:", err);
    return new Response(JSON.stringify({ error: "Unexpected server error. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
