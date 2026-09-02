import {
	spawn
} from 'node:child_process';
import {
	timingSafeEqual
} from 'node:crypto';
import {
	EventEmitter
} from 'node:events';
import {
	mkdir
} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const PORT = Number.parseInt(
	process.env.PORT ?? '8787',
	10
);
const API_KEY =
	process.env.CODEX_GATEWAY_API_KEY?.trim();
const DATA_DIR = path.resolve(
	process.env.CODEX_DATA_DIR ?? '/data/codex-users'
);
const CODEX_BIN =
	process.env.CODEX_BIN?.trim() || 'codex';
const IDLE_TIMEOUT_MS = Number.parseInt(
	process.env.CODEX_IDLE_TIMEOUT_MS ?? '1800000',
	10
);
const REQUEST_TIMEOUT_MS = Number.parseInt(
	process.env.CODEX_REQUEST_TIMEOUT_MS ?? '60000',
	10
);
const TURN_TIMEOUT_MS = Number.parseInt(
	process.env.CODEX_TURN_TIMEOUT_MS ?? '180000',
	10
);
const MAX_BODY_BYTES = 64 * 1024;
const USER_ID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_CHAT_INSTRUCTIONS =
	process.env.CODEX_CHAT_DEVELOPER_INSTRUCTIONS?.trim() ||
	'你是 Quiz 題庫系統的 AI 教學助理。請以繁體中文清楚回答使用者的學習問題。你只能提供文字解釋，不需要也不應執行 shell 指令、修改檔案或使用外部網路。';

if (!API_KEY) {
	throw new Error(
		'CODEX_GATEWAY_API_KEY is required'
	);
}

class HttpError extends Error {
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}

class CodexRpcClient extends EventEmitter {
	constructor({
		userId,
		codexHome,
		workspace
	}) {
		super();
		this.userId = userId;
		this.codexHome = codexHome;
		this.workspace = workspace;
		this.child = null;
		this.stdoutBuffer = '';
		this.nextId = 1;
		this.pending = new Map();
		this.turnText = new Map();
		this.completedTurns = new Map();
		this.turnWaiters = new Map();
	}

	async start() {
		await mkdir(
			this.codexHome,
			{
				recursive: true,
				mode: 0o700
			}
		);
		await mkdir(
			this.workspace,
			{
				recursive: true,
				mode: 0o700
			}
		);

		this.child = spawn(
			CODEX_BIN,
			[
				'app-server',
				'--stdio'
			],
			{
				cwd: this.workspace,
				env: {
					...process.env,
					CODEX_HOME: this.codexHome
				},
				stdio: [
					'pipe',
					'pipe',
					'pipe'
				]
			}
		);

		this.child.stdout.setEncoding('utf8');
		this.child.stderr.setEncoding('utf8');
		this.child.stdout.on(
			'data',
			(chunk) => this.handleStdout(chunk)
		);
		this.child.stderr.on(
			'data',
			(chunk) => {
				const message = String(chunk).trim();

				if (message) {
					console.error(
						`[codex:${this.userId}] ${message}`
					);
				}
			}
		);
		this.child.on(
			'exit',
			(code, signal) => {
				const error = new Error(
					`Codex app-server exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`
				);

				for (const pending of this.pending.values()) {
					clearTimeout(pending.timeout);
					pending.reject(error);
				}
				this.pending.clear();

				for (const waiter of this.turnWaiters.values()) {
					clearTimeout(waiter.timeout);
					waiter.reject(error);
				}
				this.turnWaiters.clear();
				this.emit('exit');
			}
		);

		await this.request(
			'initialize',
			{
				clientInfo: {
					name: 'quiz_system_gateway',
					title: 'Quiz System Codex Gateway',
					version: '1.0.0'
				}
			}
		);
		this.notify(
			'initialized',
			{}
		);
	}

	handleStdout(chunk) {
		this.stdoutBuffer += chunk;

		while (true) {
			const newlineIndex =
				this.stdoutBuffer.indexOf('\n');

			if (newlineIndex < 0) {
				break;
			}

			const line = this.stdoutBuffer
				.slice(0, newlineIndex)
				.trim();
			this.stdoutBuffer = this.stdoutBuffer
				.slice(newlineIndex + 1);

			if (!line) {
				continue;
			}

			try {
				this.handleMessage(JSON.parse(line));
			} catch (caughtError) {
				console.error(
					`[codex:${this.userId}] invalid JSON-RPC output`,
					caughtError
				);
			}
		}
	}

	handleMessage(message) {
		if (
			message &&
			Object.hasOwn(message, 'id') &&
			this.pending.has(message.id)
		) {
			const pending = this.pending.get(message.id);
			this.pending.delete(message.id);
			clearTimeout(pending.timeout);

			if (message.error) {
				pending.reject(
					new Error(
						message.error.message ??
						'Codex JSON-RPC request failed'
					)
				);
			} else {
				pending.resolve(message.result);
			}

			return;
		}

		if (!message?.method) {
			return;
		}

		if (
			message.method ===
			'item/agentMessage/delta'
		) {
			const turnId = message.params?.turnId;
			const delta = message.params?.delta;

			if (
				typeof turnId === 'string' &&
				typeof delta === 'string'
			) {
				this.turnText.set(
					turnId,
					(this.turnText.get(turnId) ?? '') +
						delta
				);
			}
		}

		if (message.method === 'turn/completed') {
			const turnId = message.params?.turn?.id;

			if (typeof turnId === 'string') {
				this.completedTurns.set(
					turnId,
					message.params
				);

				const waiter =
					this.turnWaiters.get(turnId);

				if (waiter) {
					this.turnWaiters.delete(turnId);
					clearTimeout(waiter.timeout);
					waiter.resolve(message.params);
				}
			}
		}

		this.emit(
			'notification',
			message
		);
	}

	request(method, params) {
		if (!this.child?.stdin.writable) {
			return Promise.reject(
				new Error('Codex app-server is not running')
			);
		}

		const id = this.nextId++;

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pending.delete(id);
				reject(
					new Error(
						`Codex JSON-RPC request timed out: ${method}`
					)
				);
			}, REQUEST_TIMEOUT_MS);

			this.pending.set(
				id,
				{
					resolve,
					reject,
					timeout
				}
			);
			this.child.stdin.write(
				`${JSON.stringify({
					method,
					id,
					...(params === undefined
						? {}
						: { params })
				})}\n`
			);
		});
	}

	notify(method, params) {
		if (!this.child?.stdin.writable) {
			throw new Error(
				'Codex app-server is not running'
			);
		}

		this.child.stdin.write(
			`${JSON.stringify({
				method,
				...(params === undefined
					? {}
					: { params })
			})}\n`
		);
	}

	waitForTurn(turnId) {
		const completed =
			this.completedTurns.get(turnId);

		if (completed) {
			return Promise.resolve(completed);
		}

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.turnWaiters.delete(turnId);
				reject(
					new Error('Codex turn timed out')
				);
			}, TURN_TIMEOUT_MS);

			this.turnWaiters.set(
				turnId,
				{
					resolve,
					reject,
					timeout
				}
			);
		});
	}

	takeTurnText(turnId) {
		const text = this.turnText.get(turnId) ?? '';
		this.turnText.delete(turnId);
		this.completedTurns.delete(turnId);
		return text;
	}

	close() {
		this.child?.kill('SIGTERM');
	}
}

class CodexUserSession {
	constructor(userId) {
		this.userId = userId;
		this.root = path.join(DATA_DIR, userId);
		this.codexHome = path.join(
			this.root,
			'codex-home'
		);
		this.workspace = path.join(
			this.root,
			'workspace'
		);
		this.rpc = new CodexRpcClient({
			userId,
			codexHome: this.codexHome,
			workspace: this.workspace
		});
		this.logins = new Map();
		this.loadedThreads = new Set();
		this.lastUsedAt = Date.now();
		this.chatQueue = Promise.resolve();
		this.ready = this.start();
	}

	async start() {
		await this.rpc.start();
		this.rpc.on(
			'notification',
			(notification) => {
				if (
					notification.method !==
					'account/login/completed'
				) {
					return;
				}

				const loginId =
					notification.params?.loginId;
				const login = this.logins.get(loginId);

				if (!login) {
					return;
				}

				login.status = notification.params?.success
					? 'succeeded'
					: 'failed';
				login.error =
					typeof notification.params?.error === 'string'
						? notification.params.error
						: null;
			}
		);
	}

	touch() {
		this.lastUsedAt = Date.now();
	}

	hasPendingLogin() {
		for (const login of this.logins.values()) {
			if (login.status === 'pending') {
				return true;
			}
		}

		return false;
	}

	async startDeviceLogin() {
		this.touch();
		const result = await this.rpc.request(
			'account/login/start',
			{
				type: 'chatgptDeviceCode'
			}
		);

		if (
			result?.type !== 'chatgptDeviceCode' ||
			typeof result.loginId !== 'string' ||
			typeof result.verificationUrl !== 'string' ||
			typeof result.userCode !== 'string'
		) {
			throw new Error(
				'Codex returned an invalid device login response'
			);
		}

		this.logins.set(
			result.loginId,
			{
				status: 'pending',
				error: null,
				createdAt: Date.now()
			}
		);

		return {
			loginId: result.loginId,
			verificationUrl: result.verificationUrl,
			userCode: result.userCode
		};
	}

	async getAccount() {
		this.touch();
		const result = await this.rpc.request(
			'account/read',
			{
				refreshToken: true
			}
		);

		if (result?.account?.type !== 'chatgpt') {
			return null;
		}

		return {
			type: 'chatgpt',
			email:
				typeof result.account.email === 'string'
					? result.account.email
					: null,
			planType:
				typeof result.account.planType === 'string'
					? result.account.planType
					: 'unknown'
		};
	}

	async getLoginStatus(loginId) {
		this.touch();
		const login = this.logins.get(loginId);

		if (!login) {
			const account = await this.getAccount();

			return account
				? {
					status: 'succeeded',
					error: null,
					account
				}
				: {
					status: 'failed',
					error: '授權工作階段不存在或已逾時。',
					account: null
				};
		}

		if (
			Date.now() - login.createdAt >
			15 * 60 * 1000 &&
			login.status === 'pending'
		) {
			login.status = 'failed';
			login.error = '授權工作階段已逾時。';
		}

		if (login.status === 'succeeded') {
			return {
				status: 'succeeded',
				error: null,
				account: await this.getAccount()
			};
		}

		return {
			status: login.status,
			error: login.error,
			account: null
		};
	}

	async getRateLimits() {
		this.touch();
		const result = await this.rpc.request(
			'account/rateLimits/read'
		);
		const snapshot =
			result?.rateLimitsByLimitId?.codex ??
			result?.rateLimits ??
			{};

		return {
			primary: normalizeRateLimitWindow(
				snapshot.primary
			),
			secondary: normalizeRateLimitWindow(
				snapshot.secondary
			)
		};
	}

	async logout() {
		this.touch();
		await this.rpc.request(
			'account/logout'
		);
		this.logins.clear();
		this.loadedThreads.clear();
	}

	chat(request) {
		const work = this.chatQueue.then(
			() => this.runChat(request)
		);
		this.chatQueue = work.catch(() => {});
		return work;
	}

	async runChat(request) {
		this.touch();

		if (!await this.getAccount()) {
			throw new HttpError(
				409,
				'ChatGPT account is not connected'
			);
		}

		let threadId = request.threadId ?? null;

		if (!threadId) {
			const started = await this.rpc.request(
				'thread/start',
				{
					cwd: this.workspace,
					approvalPolicy: 'never',
					sandbox: 'read-only',
					developerInstructions:
						DEFAULT_CHAT_INSTRUCTIONS
				}
			);
			threadId = started?.thread?.id;

			if (typeof threadId !== 'string') {
				throw new Error(
					'Codex did not return a thread id'
				);
			}

			this.loadedThreads.add(threadId);
		} else if (!this.loadedThreads.has(threadId)) {
			await this.rpc.request(
				'thread/resume',
				{
					threadId,
					cwd: this.workspace,
					approvalPolicy: 'never',
					sandbox: 'read-only',
					developerInstructions:
						DEFAULT_CHAT_INSTRUCTIONS,
					excludeTurns: true
				}
			);
			this.loadedThreads.add(threadId);
		}

		const text = request.context
			? `以下是 Quiz 應用程式提供的題目或學習脈絡，僅作為回答依據：\n\n${request.context}\n\n使用者問題：\n${request.message}`
			: request.message;
		const startedTurn = await this.rpc.request(
			'turn/start',
			{
				threadId,
				input: [
					{
						type: 'text',
						text
					}
				],
				approvalPolicy: 'never',
				sandboxPolicy: {
					type: 'readOnly',
					networkAccess: false
				}
			}
		);
		const turnId = startedTurn?.turn?.id;

		if (typeof turnId !== 'string') {
			throw new Error(
				'Codex did not return a turn id'
			);
		}

		const completed = await this.rpc.waitForTurn(
			turnId
		);
		const turnStatus = completed?.turn?.status;

		if (
			typeof turnStatus === 'string' &&
			turnStatus !== 'completed'
		) {
			this.rpc.takeTurnText(turnId);
			throw new Error(
				`Codex turn ended with status: ${turnStatus}`
			);
		}

		const message = this.rpc
			.takeTurnText(turnId)
			.trim();

		if (!message) {
			throw new Error(
				'Codex completed without an assistant message'
			);
		}

		return {
			threadId,
			message
		};
	}

	close() {
		this.rpc.close();
	}
}

function normalizeRateLimitWindow(window) {
	if (
		!window ||
		typeof window.usedPercent !== 'number'
	) {
		return null;
	}

	return {
		usedPercent: Math.min(
			100,
			Math.max(0, window.usedPercent)
		),
		windowMinutes:
			typeof window.windowDurationMins === 'number'
				? window.windowDurationMins
				: null,
		resetsAt:
			typeof window.resetsAt === 'number'
				? new Date(
					window.resetsAt * 1000
				).toISOString()
				: null
	};
}

const sessions = new Map();

async function getSession(userId) {
	let session = sessions.get(userId);

	if (!session) {
		session = new CodexUserSession(userId);
		sessions.set(userId, session);
		session.rpc.once('exit', () => {
			if (sessions.get(userId) === session) {
				sessions.delete(userId);
			}
		});
	}

	try {
		await session.ready;
		return session;
	} catch (caughtError) {
		if (sessions.get(userId) === session) {
			sessions.delete(userId);
		}
		session.close();
		throw caughtError;
	}
}

function isAuthorized(request) {
	const authorization =
		request.headers.authorization ?? '';
	const expected = `Bearer ${API_KEY}`;
	const actualBuffer = Buffer.from(authorization);
	const expectedBuffer = Buffer.from(expected);

	return actualBuffer.length === expectedBuffer.length &&
		timingSafeEqual(
			actualBuffer,
			expectedBuffer
		);
}

async function readJsonBody(request) {
	let size = 0;
	const chunks = [];

	for await (const chunk of request) {
		size += chunk.length;

		if (size > MAX_BODY_BYTES) {
			throw new HttpError(
				413,
				'Request body is too large'
			);
		}

		chunks.push(chunk);
	}

	if (chunks.length === 0) {
		return {};
	}

	try {
		return JSON.parse(
			Buffer.concat(chunks).toString('utf8')
		);
	} catch {
		throw new HttpError(
			400,
			'Invalid JSON body'
		);
	}
}

function validateChatRequest(body) {
	const message =
		typeof body.message === 'string'
			? body.message.trim()
			: '';
	const context =
		typeof body.context === 'string'
			? body.context.trim()
			: null;
	const threadId =
		typeof body.threadId === 'string'
			? body.threadId.trim()
			: null;

	if (!message || message.length > 8000) {
		throw new HttpError(
			400,
			'message must contain 1 to 8000 characters'
		);
	}

	if (context && context.length > 24000) {
		throw new HttpError(
			400,
			'context must not exceed 24000 characters'
		);
	}

	if (threadId && threadId.length > 255) {
		throw new HttpError(
			400,
			'threadId is invalid'
		);
	}

	return {
		message,
		context,
		threadId
	};
}

function sendJson(response, status, payload) {
	const body = JSON.stringify(payload);
	response.writeHead(
		status,
		{
			'content-type':
				'application/json; charset=utf-8',
			'content-length':
				Buffer.byteLength(body),
			'cache-control': 'no-store'
		}
	);
	response.end(body);
}

async function handleRequest(request, response) {
	const url = new URL(
		request.url ?? '/',
		`http://${request.headers.host ?? 'localhost'}`
	);

	if (
		request.method === 'GET' &&
		(url.pathname === '/healthz' ||
			url.pathname === '/readyz')
	) {
		sendJson(
			response,
			200,
			{
				ok: true
			}
		);
		return;
	}

	if (!isAuthorized(request)) {
		throw new HttpError(
			401,
			'Unauthorized'
		);
	}

	const match = url.pathname.match(
		/^\/v1\/users\/([^/]+)(\/.*)$/
	);

	if (!match) {
		throw new HttpError(
			404,
			'Not found'
		);
	}

	const userId = decodeURIComponent(match[1]);
	const resource = match[2];

	if (!USER_ID_PATTERN.test(userId)) {
		throw new HttpError(
			400,
			'Invalid user id'
		);
	}

	const session = await getSession(userId);

	if (
		request.method === 'POST' &&
		resource === '/login/device/start'
	) {
		await readJsonBody(request);
		sendJson(
			response,
			200,
			await session.startDeviceLogin()
		);
		return;
	}

	const loginMatch = resource.match(
		/^\/login\/device\/([^/]+)$/
	);

	if (
		request.method === 'GET' &&
		loginMatch
	) {
		const loginId = decodeURIComponent(
			loginMatch[1]
		);

		if (!loginId || loginId.length > 255) {
			throw new HttpError(
				400,
				'Invalid login id'
			);
		}

		sendJson(
			response,
			200,
			await session.getLoginStatus(loginId)
		);
		return;
	}

	if (
		request.method === 'GET' &&
		resource === '/account'
	) {
		sendJson(
			response,
			200,
			{
				account: await session.getAccount()
			}
		);
		return;
	}

	if (
		request.method === 'DELETE' &&
		resource === '/account'
	) {
		await session.logout();
		sendJson(
			response,
			200,
			{
				ok: true
			}
		);
		return;
	}

	if (
		request.method === 'GET' &&
		resource === '/rate-limits'
	) {
		sendJson(
			response,
			200,
			await session.getRateLimits()
		);
		return;
	}

	if (
		request.method === 'POST' &&
		resource === '/chat'
	) {
		const body = await readJsonBody(request);
		const chatRequest = validateChatRequest(body);

		sendJson(
			response,
			200,
			await session.chat(chatRequest)
		);
		return;
	}

	throw new HttpError(
		404,
		'Not found'
	);
}

const server = http.createServer(
	(request, response) => {
		void handleRequest(request, response)
			.catch((caughtError) => {
				const status =
					caughtError instanceof HttpError
						? caughtError.status
						: 500;
				const message =
					caughtError instanceof Error
						? caughtError.message
						: 'Internal server error';

				if (status >= 500) {
					console.error(caughtError);
				}

				sendJson(
					response,
					status,
					{
						error: message
					}
				);
			});
	}
);

server.listen(
	PORT,
	'0.0.0.0',
	() => {
		console.log(
			`Codex Gateway listening on :${PORT}`
		);
	}
);

setInterval(
	() => {
		const now = Date.now();

		for (const [
			userId,
			session
		] of sessions) {
			if (
			now - session.lastUsedAt > IDLE_TIMEOUT_MS &&
			!session.hasPendingLogin()
			) {
				sessions.delete(userId);
				session.close();
			}
		}
	},
	60_000
).unref();

function shutdown() {
	for (const session of sessions.values()) {
		session.close();
	}

	server.close(() => {
		process.exit(0);
	});
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
