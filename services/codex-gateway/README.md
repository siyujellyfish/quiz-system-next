# Codex Gateway

Quiz System runs on SvelteKit/Vercel, but Codex App Server needs a persistent process and persistent `CODEX_HOME`. This gateway keeps those concerns outside the serverless web app.

## Responsibilities

- Starts `codex app-server --stdio` lazily for each Quiz user.
- Uses a separate `CODEX_HOME` for every user under `CODEX_DATA_DIR/<quiz-user-id>/codex-home`.
- Starts ChatGPT device-code login with `account/login/start` and `type: "chatgptDeviceCode"`.
- Reads ChatGPT account information with `account/read`.
- Reads Codex quota windows with `account/rateLimits/read`.
- Logs out with `account/logout`.
- Runs AI conversations through `thread/start`, `thread/resume`, and `turn/start` using read-only sandboxing and no approval escalation.

OAuth access and refresh tokens stay inside the user's Codex home. They are not returned to the SvelteKit application and are not stored in Neon.

## Run locally

Build the container:

```bash
cd services/codex-gateway
docker build -t quiz-codex-gateway .
```

Run it with persistent storage:

```bash
docker run --rm \
	-p 8787:8787 \
	-e CODEX_GATEWAY_API_KEY="replace-me" \
	-v quiz-codex-data:/data/codex-users \
	quiz-codex-gateway
```

For production, pin a tested Codex release at build time instead of using `latest`:

```bash
docker build \
	--build-arg CODEX_VERSION="<tested-version>" \
	-t quiz-codex-gateway .
```

The host must provide persistent storage. Do not run this gateway as a Vercel serverless function.

## SvelteKit configuration

Set these variables in the Quiz System deployment:

```env
CODEX_GATEWAY_URL="https://your-codex-gateway.example.com"
CODEX_GATEWAY_API_KEY="replace-me"
```

Set the same `CODEX_GATEWAY_API_KEY` on the gateway. The gateway is intended for server-to-server access only; do not expose its API key to browser code.

## Gateway environment variables

- `PORT`: HTTP listen port. Default: `8787`.
- `CODEX_GATEWAY_API_KEY`: required bearer credential shared with the SvelteKit server.
- `CODEX_DATA_DIR`: persistent per-user data directory. Default: `/data/codex-users`.
- `CODEX_BIN`: Codex executable. Default: `codex`.
- `CODEX_IDLE_TIMEOUT_MS`: idle time before a user's app-server process is stopped. Default: 30 minutes. Credentials and durable Codex threads remain on disk.
- `CODEX_REQUEST_TIMEOUT_MS`: JSON-RPC request timeout. Default: 60 seconds.
- `CODEX_TURN_TIMEOUT_MS`: AI turn completion timeout. Default: 180 seconds.
- `CODEX_CHAT_DEVELOPER_INSTRUCTIONS`: optional replacement instructions for the Quiz AI assistant.

## HTTP API

All `/v1/*` routes require `Authorization: Bearer <CODEX_GATEWAY_API_KEY>`.

- `POST /v1/users/:userId/login/device/start`
- `GET /v1/users/:userId/login/device/:loginId`
- `GET /v1/users/:userId/account`
- `DELETE /v1/users/:userId/account`
- `GET /v1/users/:userId/rate-limits`
- `POST /v1/users/:userId/chat`
- `GET /healthz`
- `GET /readyz`

The chat endpoint accepts:

```json
{
	"threadId": null,
	"message": "為什麼這題不能選 B？",
	"context": "題目、選項、正確答案與靜態解析"
}
```

It returns the durable Codex thread id as the conversation id so later messages can continue the same conversation.
