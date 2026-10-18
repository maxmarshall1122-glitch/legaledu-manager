# AI-assisted review (Claude and Gemini)

AI review is **optional**. With no keys configured, everything else works and
the grading page shows a setup message instead of the AI controls.

## Configure

Set one or both keys on the **server** (e.g. `.env.local` or your host's secret store):

```bash
ANTHROPIC_API_KEY=sk-ant-…          # https://console.anthropic.com → API keys
ANTHROPIC_MODEL=claude-opus-5-5     # default

GEMINI_API_KEY=…                    # https://aistudio.google.com → API keys
GEMINI_MODEL=gemini-2.5-pro         # set to a model your Google account offers

AI_TIMEOUT_SECONDS=120   # per request
AI_DAILY_LIMIT=30        # suggestions per staff user per UTC day
AI_MAX_DOCUMENT_CHARS=60000
```

Restart the server. Settings → System status shows each provider as
configured/not configured (keys are never displayed or sent to the browser).

SDKs: `@anthropic-ai/sdk` (Messages API with structured JSON output, adaptive
thinking, server-side refusal fallback for supported models) and
`@google/genai` (`generateContent` with a JSON response schema).

## What happens on “Request AI suggestion”

1. The server checks the user is staff and re-loads the submission.
2. Text is extracted from the current version's files (PDF, DOCX, PPTX, TXT).
3. Only the minimum is sent: assignment title/type/instructions, the rubric,
   and the document text, labelled “Document 1 (PDF)” etc. **No student name,
   student ID or file name** is sent. Text beyond `AI_MAX_DOCUMENT_CHARS` is cut
   and the cut is shown to the lecturer.
4. The student text is wrapped in `<student_submission>` tags; forged tags are
   neutralised, and the system prompt instructs the model to treat it as
   untrusted data and ignore instructions inside it. The model has no tools.
5. The response must match a strict JSON schema; every criterion must be
   present with a score within its maximum. Anything else is discarded.
6. The result is stored as a **pending suggestion** (`ai_suggestions`, with the
   raw response kept server-side only). No review or grade is created.
7. The lecturer can copy it into the grading form, edit, and approve — the
   suggestion is then marked *approved* (unchanged) or *edited* — or reject it.
   Reviews created from a suggestion are labelled “AI-assisted”.

Timeouts, rate limits (provider 429 and per-user limits), authentication and
refusals produce safe, translated messages; provider error details are never
shown to users.

## Policy notes

- AI output is advisory. It is not used to assign final grades, decide
  plagiarism or determine AI authorship.
- Sending student work to a third-party provider may require your
  institution's approval and a data-processing agreement. Check provider
  data-retention terms and configure accordingly before enabling.
- Live calls to Anthropic/Google were **not** made during this build (no keys
  were available); the workflow is covered by tests with a fake provider.
