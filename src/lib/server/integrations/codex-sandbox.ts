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

function getRuntimeEnv(
	name: string
) {
	const svelteValue = normalizeOptionalString(
		env[name]
	);

	if (svelteValue) {
		return svelteValue;
	}

	return normalizeOptionalString(
		process.env[name]
	);
}

function getCodexVersion() {
	return getRuntimeEnv('CODEX_VERSION') ?? 'latest';
}

function getSandboxCredentials() {
	const token = getRuntimeEnv('VERCEL_TOKEN');
	const teamId = getRuntimeEnv('VERCEL_TEAM_ID');
	const projectId = getRuntimeEnv('VERCEL_PROJECT_ID');

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
		getRuntimeEnv('VERCEL_OIDC_TOKEN') ||
		(
			getRuntimeEnv('VERCEL_TOKEN') &&
			getRuntimeEnv('VERCEL_TEAM_ID') &&
			getRuntimeEnv('VERCEL_PROJECT_ID')
		) ||
		getRuntimeEnv('VERCEL')
	);
}

export function getCodexSandboxName(
	userId: string
) {
	return `quiz-codex-${userId}`;
}

function getBridgeSource() {
	const bridgeEnv = {
		PORT: String(BRIDGE_PORT),
		CODEX_GATEWAY_API_KEY:
			LOCAL_BRIDGE_API_KEY,
		CODEX_DATA_DIR,
		CODEX_IDLE_TIMEOUT_MS:
			String(SANDBOX_TIMEOUT_MS),
		CODEX_REQUEST_TIMEOUT_MS:
			String(60 * 1000),
		CODEX_TURN_TIMEOUT_MS:
			String(180 * 1000),
		CODEX_CHAT_DEVELOPER_INSTRUCTIONS:
			getRuntimeEnv(
				'CODEX_CHAT_DEVELOPER_INSTRUCTIONS'
			) ?? ''
	};
	const prelude = Object.entries(bridgeEnv)
		.map(
			([name, value]) =>
				`process.env[${JSON.stringify(name)}] = ${JSON.stringify(value)};`
		)
		.join('\n');
	const loopbackBridgeSource = bridgeSource.replace(
		"'0.0.0.0'",
		"'127.0.0.1'"
	);

	return `${prelude}\n${loopbackBridgeSource}`;
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
			name: getCodexSandboxName(userId),
			resume: true,
			timeout: SANDBOX_TIMEOUT_MS
		});
	} catch (caughtError) {
		if (isMissingSandboxError(caughtError)) {
			throw new CodexSandboxNotFoundError();
		}

		throw caughtError;
	}
}

async function ensureBridge(
	sandbox: Sandbox
) {
	await sandbox.writeFiles([
		{
			path: BRIDGE_PATH,
			content: Buffer.from(getBridgeSource())
		}
	]);

	const healthResult = await sandbox.runCommand(
		'node',
		[
			'-e',
			NODE_FETCH_SCRIPT,
			'GET',
			`http://127.0.0.1:${BRIDGE_PORT}/healthz`,
			LOCAL_BRIDGE_API_KEY,
			''
		],
		{
			timeoutMs: 10 * 1000
		}
	);

	if (
		'exitCode' in healthResult &&
		healthResult.exitCode === 0
	) {
		return;
	}

	const startResult = await sandbox.runCommand(
		'node',
		[BRIDGE_PATH],
		{
			detached: true
		}
	);

	if (
		'exitCode' in startResult &&
		startResult.exitCode !== 0
	) {
		await assertCommandSucceeded(
			startResult,
			'無法啟動 Codex Sandbox bridge。'
		);
	}

	const startedAt = Date.now();

	while (
		Date.now() - startedAt < 15 * 1000
	) {
		await new Promise((resolve) =>
			setTimeout(resolve, 300)
		);

		const retryHealth = await sandbox.runCommand(
			'node',
			[
				'-e',
				NODE_FETCH_SCRIPT,
				'GET',
				`http://127.0.0.1:${BRIDGE_PORT}/healthz`,
				LOCAL_BRIDGE_API_KEY,
				''
			],
			{
				timeoutMs: 10 * 1000
			}
		);

		if (
			'exitCode' in retryHealth &&
			retryHealth.exitCode === 0
		) {
			return;
		}
	}

	throw new CodexSandboxError(
		'Codex Sandbox bridge 啟動逾時。',
		503
	);
}

async function requestBridge<T>(
	sandbox: Sandbox,
	method: string,
	path: string,
	body?: unknown
): Promise<T> {
	await ensureBridge(sandbox);

	const encodedBody = body === undefined
		? ''
		: JSON.stringify(body);

	const result = await sandbox.runCommand(
		'node',
		[
			'-e',
			NODE_FETCH_SCRIPT,
			method,
			`http://127.0.0.1:${BRIDGE_PORT}${path}`,
			LOCAL_BRIDGE_API_KEY,
			encodedBody
		],
		{
			timeoutMs: SANDBOX_OPERATION_TIMEOUT_MS
		}
	);

	await assertCommandSucceeded(
		result,
		'Vercel Sandbox 無法連線至 Codex bridge。'
	);

	const raw = await result.stdout();
	let envelope: {
		status: number;
		body: string;
	};

	try {
		envelope = JSON.parse(raw);
	} catch {
		throw new CodexSandboxError(
			'Vercel Sandbox 回傳了無效的 bridge response。',
			502
		);
	}

	let payload: unknown = null;

	if (envelope.body) {
		try {
			payload = JSON.parse(envelope.body);
		} catch {
			payload = envelope.body;
		}
	}

	if (
		envelope.status < 200 ||
		envelope.status >= 300
	) {
		const message =
			typeof payload === 'object' &&
			payload !== null &&
			'message' in payload &&
			typeof payload.message === 'string'
				? payload.message
				: `Codex Sandbox bridge request failed (${envelope.status})`;

		throw new CodexSandboxError(
			message,
			envelope.status
		);
	}

	return payload as T;
}

async function stopSandbox(
	sandbox: Sandbox
) {
	try {
		await sandbox.stop();
	} catch (caughtError) {
		console.error(
			'Unable to stop Vercel Codex Sandbox',
			caughtError
		);
	}
}

export async function startCodexDeviceLogin(
	userId: string
): Promise<CodexDeviceLogin> {
	if (!isCodexSandboxConfigured()) {
		throw new CodexSandboxError(
			'Vercel Sandbox 尚未設定。',
			503
		);
	}

	const sandbox = await createOrGetCodexSandbox(
		userId
	);

	return requestBridge<CodexDeviceLogin>(
		sandbox,
		'POST',
		`/v1/users/${userId}/login/device/start`
	);
}

export async function getCodexDeviceLoginStatus(
	userId: string,
	loginId: string
): Promise<CodexDeviceLoginStatus> {
	if (!isCodexSandboxConfigured()) {
		throw new CodexSandboxError(
			'Vercel Sandbox 尚未設定。',
			503
		);
	}

	const sandbox = await getExistingCodexSandbox(
		userId
	);

	const status =
		await requestBridge<CodexDeviceLoginStatus>(
			sandbox,
			'GET',
			`/v1/users/${userId}/login/device/${loginId}`
		);

	if (status.status !== 'pending') {
		await stopSandbox(sandbox);
	}

	return status;
}

export async function getCodexAccount(
	userId: string
): Promise<CodexSandboxAccount | null> {
	if (!isCodexSandboxConfigured()) {
		throw new CodexSandboxError(
			'Vercel Sandbox 尚未設定。',
			503
		);
	}

	const sandbox = await getExistingCodexSandbox(
		userId
	);

	try {
		const response = await requestBridge<{
			account: CodexSandboxAccount | null;
		}>(
			sandbox,
			'GET',
			`/v1/users/${userId}/account`
		);

		return response.account;
	} finally {
		await stopSandbox(sandbox);
	}
}

export async function getCodexUsage(
	userId: string
): Promise<CodexUsage> {
	if (!isCodexSandboxConfigured()) {
		throw new CodexSandboxError(
			'Vercel Sandbox 尚未設定。',
			503
		);
	}

	const sandbox = await getExistingCodexSandbox(
		userId
	);

	try {
		return await requestBridge<CodexUsage>(
			sandbox,
			'GET',
			`/v1/users/${userId}/rate-limits`
		);
	} finally {
		await stopSandbox(sandbox);
	}
}

export async function logoutCodexAccount(
	userId: string
) {
	if (!isCodexSandboxConfigured()) {
		throw new CodexSandboxError(
			'Vercel Sandbox 尚未設定。',
			503
		);
	}

	const sandbox = await getExistingCodexSandbox(
		userId
	);

	try {
		await requestBridge(
			sandbox,
			'DELETE',
			`/v1/users/${userId}/account`
		);
	} finally {
		await stopSandbox(sandbox);
	}

	try {
		await sandbox.delete({
			deleteSnapshots: true
		});
	} catch (caughtError) {
		console.error(
			'Unable to delete Vercel Codex Sandbox',
			caughtError
		);
		throw caughtError;
	}
}

export async function sendCodexChat(
	userId: string,
	request: CodexChatRequest
): Promise<CodexChatResponse> {
	if (!isCodexSandboxConfigured()) {
		throw new CodexSandboxError(
			'Vercel Sandbox 尚未設定。',
			503
		);
	}

	const sandbox = await getExistingCodexSandbox(
		userId
	);

	try {
		return await requestBridge<CodexChatResponse>(
			sandbox,
			'POST',
			`/v1/users/${userId}/chat`,
			request
		);
	} finally {
		await stopSandbox(sandbox);
	}
}
