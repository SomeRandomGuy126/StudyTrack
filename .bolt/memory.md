# Project memory

## Product intent & audience

- AI-powered student productivity and revision management web app.
- Core features: automated spaced repetition, task tracking, notes, flashcards, responsive modern dashboard.
- AI features include at least two AI-powered surfaces: "Learning Centre tutor" and "Study AI chat".
- Audience: students needing structured revision, task management, and AI-assisted study help.

## Brand personality & voice

- Productivity-oriented, modern, student-friendly.
- AI tutoring surfaces should feel responsive and helpful; error states should be transparent and actionable.

## Visual design & UX direction

- Responsive modern dashboard layout expected across the app.
- Vite + React + Tailwind CSS + Lucide React icon set as the UI baseline.
- `@/` path alias maps to `src/`; prefer it over deep relative imports.
- Aim for production-quality, non-cookie-cutter UI per global instructions referenced in `.bolt/prompt`.

## Decisions, constraints & rationale

- AI backend supports multiple providers via auto-detection by key format:
  - Groq keys (prefix `gsk_`) → Groq API, Llama 3.3 model.
  - OpenAI keys (prefix `sk-`) → OpenAI API (fallback if present).
- Provider-specific secrets checked in order: `AI_API_KEY`, `BoltWebsiteStudyTrackers`, `OPENAI_API_KEY`.
- Recommended secret name going forward: `AI_API_KEY` (provider-agnostic).
- Existing user key saved under custom secret `BoltWebsiteStudyTrackers` (Groq key).
- All API keys managed via Bolt Secrets (database icon → Secrets), never in app code.
- Groq chosen/used by user; noted as faster than OpenAI for response latency.
- AI error messages are provider-aware and surfaced to UI with actionable guidance.

## Open questions & assumptions

- Assumes users will configure a valid AI API key (Groq or OpenAI) with sufficient provider billing/usage allowance.
- Exact UI/brand palette, typography, and spacing tokens not yet specified — infer modern dashboard conventions until set.
- Spaced repetition algorithm details and persistence approach not yet confirmed.
- Authentication and multi-user data isolation behavior not yet discussed.
- Whether to standardize all future secrets under `AI_API_KEY` or keep backward-compatible aliases long-term not yet decided.