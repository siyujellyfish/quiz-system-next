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
- Off-topic or ambiguously related requests are refused with the fixed response `這個問題與目前題目無關，我只能協助解釋目前這一題。` and must not append an explanation or redirect answer.

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

## Prompt and quota optimization

- The server-side first-turn context is intentionally compact: mode, question, options, answer/result, correct answer, and static explanation only.
- Stable safety and scope rules live in compact developer instructions instead of being duplicated in every first-turn context.
- Default answers are instructed to stay concise unless the user explicitly requests detail.
- Codex usage refresh after chat is throttled to at most about once per minute unless the previous usage fetch failed.
- A usage refresh and the chat request share one Vercel Sandbox `runCommand`; the helper performs both loopback bridge calls within that command when a refresh is due.
- `ai_conversations.updated_at` is also throttled to avoid writing on every follow-up turn.

## Sandbox lifecycle

- Opening AskAI performs a DB-only connection/status check and does not wake the Sandbox.
- The first actual AI turn resumes the user's persistent Sandbox.
- Successful AskAI turns keep the Sandbox warm for a short client-side lease instead of immediately stopping/snapshotting after every turn.
- Closing the sidebar, changing question, leaving the page, or reaching the idle lease timeout releases/stops the Sandbox.
- The persistent Sandbox runtime timeout remains a fallback if a browser cannot deliver the release request.
- Bridge startup checks `/healthz` before rewriting or restarting the local bridge, avoiding unnecessary file writes when the bridge is already healthy.

## Usage synchronization

When a usage refresh is due, the same warm Sandbox session reads `account/rateLimits/read`. The latest snapshot is saved to `codex_usage_snapshots`. A usage-refresh failure never changes an already successful AI answer into a failure; the previous snapshot is retained and marked stale.

## UX

- Unlinked users see the ChatGPT connection CTA before a textarea is shown.
- Cached Codex quota is shown when available.
- Quick prompts cover answer rationale, incorrect selections, option comparison, simpler explanations, memory aids, and similar practice questions.
- Assistant responses support safe Markdown without raw HTML rendering.
- Assistant messages can be copied.
- Retry is available for retryable failures and lost app conversation mappings.
- A new local conversation can be started without deleting historical provider threads.
- Message panes auto-scroll while sending and receiving.
- Desktop/web uses a non-overlay right sidebar below the fixed global header; small screens retain an inline panel.
- Desktop sidebar width is user-resizable and persisted locally.
- `Enter` sends, `Shift+Enter` inserts a newline, and `Escape` closes AskAI when no generation is active.
- Opening AskAI focuses the visible composer; closing it restores focus to the AskAI launch button.
- Stop/Cancel interrupts the provider turn and leaves a visible `已停止產生回答。` marker in the conversation.
- From six completed assistant turns onward, AskAI recommends starting a fresh conversation to reduce accumulated context; the warning becomes stronger at eight turns.

Streaming and cross-reload message persistence are intentionally deferred.
