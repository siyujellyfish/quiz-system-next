import {
	env
} from '$env/dynamic/private';
import {
	Sandbox
} from '@vercel/sandbox';

import bridgeSource
	from '../../../../services/codex-gateway/server.mjs?raw';

export type CodexUsageWindow = {
	usedPercent: number;
	windowMinutes: number | null;
	resetsAt: string | null;
};

export type CodexUsage = {
	primary: CodexUsageWindow | null;
	secondary: CodexUsageWindow | null;
};

export type CodexSandboxAccount = {
	type: 'chatgpt';
	email: string | null;
	planType: string;
};

export type CodexDeviceLogin = {
	loginId: string;
	verificationUrl: string;
	userCode: string;
};

export type CodexDeviceLoginStatus = {
	status: 'pending' | 'succeeded' | 'failed';
	error: string | null;
	account: CodexSandboxAccount | null;
};

export type CodexChatRequest = {
	threadId?: string | null;
	message: string;
	context?: string | null;
};

export type CodexChatResponse = {
	threadId: string;
	message: string;
};

export class CodexSandboxError extends Error {
	status: number;

	constructor(
		message: string,
		status: number
	) {
		super(message);
		this.name = 'CodexSandboxError';
		this.status = status;
	}
}

export class CodexSandboxNotFoundError
	extends CodexSandboxError {
	constructor() {
		super(
			'ChatGPT 的 Vercel Sandbox 已不存在，請重新連結 ChatGPT。',
			410
		);
		this.name = 'CodexSandboxNotFoundError';
	}
}

const BRIDGE_PORT = 8787;
const BRIDGE_PATH =
	'/vercel/sandbox/quiz-codex-bridge.mjs';
const LOCAL_BRIDGE_API_KEY =
	'quiz-system-sandbox-local';
const CODEX_DATA_DIR =
	'/vercel/sandbox/codex-data';
const SANDBOX_TIMEOUT_MS =
	20 * 60 * 1000;
const SANDBOX_OPERATION_TIMEOUT_MS =
	190 * 1000;
const CODEX_INSTALL_TIMEOUT_MS =
	5 * 60 * 1000;

const NODE_FETCH_SCRIPT = `
const [method, url, apiKey, body] = process.argv.slice(1);
try {
	const response = await fetch(url, {
		method,
		headers: {
			accept: 'application/json',
			...(apiKey ? { authorization: 'Bearer ' + apiKey } : {}),
			...(body ? { 'content-type': 'application/json' } : {})
		},
		...(body ? { body } : {})
	});
	const text = await response.text();
	process.stdout.write(JSON.stringify({ status: response.status, body: text }));
} catch (error) {
	process.stderr.write(error instanceof Error ? error.message : String(error));
	process.exit(2);
}
`;

function normalizeOptionalString(
	value: string | undefined
) {
	const normalized = value?.trim();
	return normalized ? normalized : null;
}

function getCodexVersion() {
	return normalizeOptionalString(
		env.CODEX_VERSION
	) ?? 'latest';
}

function getSandboxCredentials() {
	const token = normalizeOptionalString(
		env.VERCEL_TOKEN
	);
	const teamId = normalizeOptionalString(
		env.VERCEL_TEAM_ID
	);
	const projectId = normalizeOptionalString(
		env.VERCEL_PROJECT_ID
	);

	if (token && teamId && projectId) {
		return {
			token,
			teamId,
			projectId
		};
	}

	return {};
}

export function isCodexSandboxConfigured() {
	return Boolean(
		normalizeOptionalString(env.VERCEL_OIDC_TOKEN) ||
		(
			normalizeOptionalString(env.VERCEL_TOKEN) &&
			normalizeOptionalString(env.VERCEL_TEAM_ID) &&
			normalizeOptionalString(env.VERCEL_PROJECT_ID)
		) ||
		normalizeOptionalString(env.VERCEL)
	);
}

export function getCodexSandboxName(
	userId: string
) {
	return `quiz-codex-${userId}`;
}

function getApiStatus(
	error: unknown
) {
	if (
		typeof error !== 'object' ||
		error === null ||
		!('response' in error)
	) {
		return null;
	}

	const response = (
		error as {
			response?: {
				status?: unknown;
			};
		}
	).response;

	return typeof response?.status === 'number'
		? response.status
		: null;
}

function isMissingSandboxError(
	error: unknown
) {
	const status = getApiStatus(error);
	return status === 404 || status === 410;
}

async function assertCommandSucceeded(
	result: Awaited<ReturnType<Sandbox['runCommand']>>,
	message: string
) {
	if ('exitCode' in result && result.exitCode === 0) {
		return;
	}

	const stderr = 'stderr' in result
		? (await result.stderr()).trim()
		: '';

	throw new CodexSandboxError(
		stderr || message,
		503
	);
}

async function provisionSandbox(
	sandbox: Sandbox
) {
	const install = await sandbox.runCommand(
		'npm',
		[
			'install',
			'--global',
			`@openai/codex@${getCodexVersion()}`
		],
		{
			timeoutMs: CODEX_INSTALL_TIMEOUT_MS
		}
	);

	await assertCommandSucceeded(
		install,
		'無法在 Vercel Sandbox 安裝 Codex CLI。'
	);
}

async function createOrGetCodexSandbox(
	userId: string
) {
	return Sandbox.getOrCreate({
		...getSandboxCredentials(),
		name: getCodexSandboxName(userId),
		persistent: true,
		timeout: SANDBOX_TIMEOUT_MS,
		resources: {
			vcpus: 1
		},
		snapshotExpiration: 0,
		keepLastSnapshots: {
			count: 2,
			expiration: 0
		},
		tags: {
			app: 'quiz-system',
			purpose: 'codex-chatgpt'
		},
		onCreate: provisionSandbox
	});
}

async function getExistingCodexSandbox(
	userId: string
) {
	try {
		return await Sandbox.get({
			...getSandboxCredentials(),
			name: getCodexSandboxName(userId)
		});
	} catch (caughtError) {
		if (isMissingSandboxError(caughtError)) {
			throw new CodexSandboxNotFoundError();
		}

		throw caughtError;
	}
}

async function runLocalFetch(
	sandbox: Sandbox,
	method: string,
	path: string,
	body?: unknown,
	includeAuthorization = true
) {
	const serializedBody = body === undefined
		? ''
		: JSON.stringify(body);
	const result = await sandbox.runCommand(
		'node',
		[
			'--input-type=module',
			'-e',
			NODE_FETCH_SCRIPT,
			method,
			`http://127.0.0.1:${BRIDGE_PORT}${path}`,
			includeAuthorization
				? LOCAL_BRIDGE_API_KEY
				: '',
			serializedBody
		],
		{
			timeoutMs: SANDBOX_OPERATION_TIMEOUT_MS
		}
	);

	await assertCommandSucceeded(
		result,
		'無法連線至 Codex Sandbox bridge。'
	);

	const raw = (await result.stdout()).trim();
	let envelope: {
		status: number;
		body: string;
	};

	try {
		envelope = JSON.parse(raw) as {
			status: number;
			body: string;
		};
	} catch {
		throw new CodexSandboxError(
			'Codex Sandbox bridge 回應格式不正確。',
			503
		);
	}

	let payload: unknown = {};

	if (envelope.body) {
		try {
			payload = JSON.parse(envelope.body);
		} catch {
			throw new CodexSandboxError(
				'Codex Sandbox bridge 未回傳有效 JSON。',
				503
			);
		}
	}

	if (
		envelope.status < 200 ||
		envelope.status >= 300
	) {
		const errorMessage =
			typeof payload === 'object' &&
			payload !== null &&
			'error' in payload &&
			typeof payload.error === 'string'
				? payload.error
				: `Codex Sandbox bridge request failed (${envelope.status})`;

		throw new CodexSandboxError(
			errorMessage,
			envelope.status
		);
	}

	return payload;
}

async function bridgeIsReady(
	sandbox: Sandbox
) {
	try {
		await runLocalFetch(
			sandbox,
			'GET',
			'/healthz',
			undefined,
			false
		);
		return true;
	} catch {
		return false;
	}
}

async function ensureBridge(
	sandbox: Sandbox
) {
	await sandbox.writeFiles([
		{
			path: BRIDGE_PATH,
			content: bridgeSource,
			mode: 0o600
		}
	]);

	if (await bridgeIsReady(sandbox)) {
		return;
	}

	await sandbox.runCommand({
		cmd: 'node',
		args: [BRIDGE_PATH],
		detached: true,
		timeoutMs: SANDBOX_TIMEOUT_MS,
		env: {
			PORT: String(BRIDGE_PORT),
			CODEX_GATEWAY_API_KEY:
				LOCAL_BRIDGE_API_KEY,
			CODEX_DATA_DIR,
			CODEX_BIN: 'codex',
			CODEX_IDLE_TIMEOUT_MS:
				String(SANDBOX_TIMEOUT_MS),
			CODEX_REQUEST_TIMEOUT_MS: '60000',
			CODEX_TURN_TIMEOUT_MS: '180000',
			...(normalizeOptionalString(
				env.CODEX_CHAT_DEVELOPER_INSTRUCTIONS
			)
				? {
					CODEX_CHAT_DEVELOPER_INSTRUCTIONS:
						env.CODEX_CHAT_DEVELOPER_INSTRUCTIONS!.trim()
				}
				: {})
		}
	});

	for (let attempt = 0; attempt < 20; attempt++) {
		await new Promise((resolve) => {
			setTimeout(resolve, 250);
		});

		if (await bridgeIsReady(sandbox)) {
			return;
		}
	}

	throw new CodexSandboxError(
		'Codex Sandbox bridge 啟動失敗。',
		503
	);
}

function userPath(
	userId: string
) {
	return `/v1/users/${encodeURIComponent(userId)}`;
}

async function requestFromSandbox<T>(
	sandbox: Sandbox,
	userId: string,
	resource: string,
	method = 'GET',
	body?: unknown
): Promise<T> {
	await ensureBridge(sandbox);
	return await runLocalFetch(
		sandbox,
		method,
		`${userPath(userId)}${resource}`,
		body
	) as T;
}

async function stopSandboxQuietly(
	sandbox: Sandbox
) {
	try {
		await sandbox.stop();
	} catch (caughtError) {
		console.error(
			'Unable to stop persistent Codex Sandbox',
			caughtError
		);
	}
}

export async function startCodexDeviceLogin(
	userId: string
) {
	const sandbox = await createOrGetCodexSandbox(
		userId
	);

	try {
		return await requestFromSandbox<CodexDeviceLogin>(
			sandbox,
			userId,
			'/login/device/start',
			'POST',
			{}
		);
	} catch (caughtError) {
		await stopSandboxQuietly(sandbox);
		throw caughtError;
	}
}

export async function getCodexDeviceLoginStatus(
	userId: string,
	loginId: string
) {
	const sandbox = await getExistingCodexSandbox(
		userId
	);
	const status =
		await requestFromSandbox<CodexDeviceLoginStatus>(
			sandbox,
			userId,
			`/login/device/${encodeURIComponent(loginId)}`
		);

	if (status.status !== 'pending') {
		await stopSandboxQuietly(sandbox);
	}

	return status;
}

export async function getCodexAccount(
	userId: string
) {
	const sandbox = await getExistingCodexSandbox(
		userId
	);

	try {
		const payload =
			await requestFromSandbox<{
				account: CodexSandboxAccount | null;
			}>(
				sandbox,
				userId,
				'/account'
			);

		return payload.account;
	} finally {
		await stopSandboxQuietly(sandbox);
	}
}

export async function getCodexUsage(
	userId: string
) {
	const sandbox = await getExistingCodexSandbox(
		userId
	);

	try {
		return await requestFromSandbox<CodexUsage>(
			sandbox,
			userId,
			'/rate-limits'
		);
	} finally {
		await stopSandboxQuietly(sandbox);
	}
}

export async function logoutCodexAccount(
	userId: string
) {
	const sandbox = await getExistingCodexSandbox(
		userId
	);
	let logoutError: unknown = null;

	try {
		await requestFromSandbox<{ ok: true }>(
			sandbox,
			userId,
			'/account',
			'DELETE'
		);
	} catch (caughtError) {
		logoutError = caughtError;
	}

	try {
		await sandbox.delete({
			deleteOrphanSnapshots: true
		});
	} catch (deleteError) {
		if (logoutError) {
			throw logoutError;
		}
		throw deleteError;
	}
}

export async function sendCodexChat(
	userId: string,
	request: CodexChatRequest
) {
	const sandbox = await getExistingCodexSandbox(
		userId
	);

	try {
		return await requestFromSandbox<CodexChatResponse>(
			sandbox,
			userId,
			'/chat',
			'POST',
			request
		);
	} finally {
		await stopSandboxQuietly(sandbox);
	}
}
