/*
# Add AI customisation preferences to profiles

1. Modified Tables
- `profiles`: two new nullable text columns:
  - `ai_tone` — preferred AI writing tone ('friendly' | 'formal' | 'encouraging' | 'concise'), default 'friendly'.
  - `ai_depth` — preferred explanation depth ('simple' | 'balanced' | 'thorough'), default 'balanced'.
  Both are used by the backend AI function to personalise every generation
  (flashcards, notes, quizzes, tutor). Nullable with defaults, so no backfill needed.

2. Security
- No policy changes: columns are covered by existing profiles RLS policies.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_tone text NOT NULL DEFAULT 'friendly';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_depth text NOT NULL DEFAULT 'balanced';
