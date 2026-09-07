# Codex Sandbox bridge

This directory is no longer deployed as a standalone service.

`server.mjs` is bundled into the SvelteKit server as raw source and copied into each user's persistent Vercel Sandbox by `src/lib/server/integrations/codex-sandbox.ts`.

Each Quiz user gets a named persistent Sandbox:

```text
quiz-codex-<quiz-user-uuid>
```

Inside that Sandbox the bridge starts `codex app-server --stdio` with a user-specific persistent `CODEX_HOME` under `/vercel/sandbox/codex-data`. The bridge only listens inside the Sandbox VM and no port is exposed publicly.

## Responsibilities

- Start ChatGPT device-code login with `account/login/start` and `type: "chatgptDeviceCode"`.
- Read ChatGPT account information with `account/read`.
- Read Codex quota windows with `account/rateLimits/read`.
- Log out with `account/logout`.
- Run AI conversations through `thread/start`, `thread/resume`, and `turn/start` using read-only sandboxing and no approval escalation.

OAuth access and refresh tokens remain in the persistent Vercel Sandbox filesystem. They are not returned to the browser and are not stored in Neon.

## Lifecycle

- Device login: the Sandbox stays running while the browser polls the authorization status.
- Profile/account/rate-limit reads: the Sandbox resumes, performs the request, then stops and snapshots automatically.
- AI chat: the Sandbox resumes, runs/resumes the Codex thread, returns the answer, then stops and snapshots automatically.
- Disconnect: the app requests `account/logout`, then deletes the Sandbox and orphaned snapshots before deleting Neon metadata.

Do not deploy this directory as a Docker service. The previous `CODEX_GATEWAY_URL` and `CODEX_GATEWAY_API_KEY` configuration is obsolete.
