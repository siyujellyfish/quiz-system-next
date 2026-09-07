# AskAI production flow

AskAI is an explicit, post-grading tutor powered by the connected user's own ChatGPT / Codex account.

## Security boundary

- Browser-visible conversation IDs are Quiz-owned UUIDs, never Codex thread IDs.
- `ai_conversations` maps a Quiz user + question to a provider thread ID on the server.
- The first turn requires a short-lived, session-bound `aiContextToken` issued only after server-side grading.
- Practice and Wrong Question grading responses issue the token directly for authenticated users.
- Exam Review obtains a token only after the server confirms the latest attempt for that bank is submitted and contains that question.
- The browser does not provide trusted question context, correct answers, or static explanations to AskAI.
- The server reloads the question, options, answer key, and static explanation from Neon before the first Codex turn.
- Question-bank text is explicitly treated as untrusted learning content, not as system/developer/tool instructions.

## Conversation flow

First turn:

1. Verify user session and `aiContextToken`.
2. Load authoritative question context from Neon.
3. Start a new Codex thread in the user's persistent Vercel Sandbox.
4. Persist the provider thread ID in `ai_conversations`.
5. Return only the Quiz conversation UUID and assistant message to the browser.

Follow-up turn:

1. Resolve the Quiz conversation UUID by current `user_id`.
2. Require the mapped `question_id` to match the current question.
3. Resume the provider thread server-side.
4. Return the assistant message while keeping the provider thread ID private.

## Usage synchronization

After a successful Codex turn, the same resumed Sandbox session reads `account/rateLimits/read` before stopping. The latest snapshot is saved to `codex_usage_snapshots`. A usage-refresh failure never changes an already successful AI answer into a failure; the previous snapshot is retained and marked stale.

## UX

- Opening AskAI performs a DB-only connection/status check and does not wake the Sandbox.
- Unlinked users see the ChatGPT connection CTA before a textarea is shown.
- Cached Codex quota is shown when available.
- Quick prompts cover answer rationale, incorrect selections, option comparison, simpler explanations, memory aids, and similar practice questions.
- Assistant responses support safe Markdown without raw HTML rendering.
- Assistant messages can be copied.
- Retry is available for retryable failures and lost app conversation mappings.
- A new local conversation can be started without deleting historical provider threads.
- Message panes auto-scroll while sending and receiving.

Streaming and cross-reload message persistence are intentionally deferred beyond P1.
