import {
	env
} from '$env/dynamic/private';

export type CodexUsageWindow = {
	usedPercent: number;
	windowMinutes: number | null;
	resetsAt: string | null;
};

export type CodexUsage = {
	primary: CodexUsageWindow | null;
	secondary: CodexUsageWindow | null;
};

export type CodexGatewayAccount = {
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
	account: CodexGatewayAccount | null;
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

export class CodexGatewayError extends Error {
	status: number;

	constructor(
		message: string,
		status: number
	) {
		super(message);
		this.name = 'CodexGatewayError';
		this.status = status;
	}
}

function normalizeOptionalString(
	value: string | undefined
) {
	const normalized = value?.trim();
	return normalized ? normalized : null;
}

function getCodexGatewayConfig() {
	const baseUrl = normalizeOptionalString(
		env.CODEX_GATEWAY_URL
	);
	const apiKey = normalizeOptionalString(
		env.CODEX_GATEWAY_API_KEY
	);

	if (!baseUrl || !apiKey) {
		return null;
	}

	return {
		baseUrl: baseUrl.replace(/\/+$/, ''),
		apiKey
	};
}

export function isCodexGatewayConfigured() {
	return getCodexGatewayConfig() !== null;
}

async function codexGatewayRequest<T>(
	path: string,
	init: RequestInit = {}
): Promise<T> {
	const config = getCodexGatewayConfig();

	if (!config) {
		throw new CodexGatewayError(
			'Codex Gateway is not configured',
			503
		);
	}

	const url = new URL(
		path.replace(/^\/+/, ''),
		`${config.baseUrl}/`
	);
	const headers = new Headers(init.headers);

	headers.set(
		'authorization',
		`Bearer ${config.apiKey}`
	);
	headers.set('accept', 'application/json');

	if (init.body !== undefined) {
		headers.set(
			'content-type',
			'application/json'
		);
	}

	let response: Response;

	try {
		response = await fetch(url, {
			...init,
			headers,
			signal: init.signal ?? AbortSignal.timeout(190_000)
		});
	} catch (caughtError) {
		throw new CodexGatewayError(
			caughtError instanceof Error
				? `Codex Gateway request failed: ${caughtError.message}`
				: 'Codex Gateway request failed',
			503
		);
	}

	if (!response.ok) {
		let message = `Codex Gateway request failed (${response.status})`;

		try {
			const payload = await response.json() as {
				error?: unknown;
			};

			if (
				typeof payload.error === 'string' &&
				payload.error.trim()
			) {
				message = payload.error;
			}
		} catch {
			// Keep the fallback message when the gateway does not return JSON.
		}

		throw new CodexGatewayError(
			message,
			response.status
		);
	}

	return await response.json() as T;
}

function userPath(userId: string) {
	return `v1/users/${encodeURIComponent(userId)}`;
}

export async function startCodexDeviceLogin(
	userId: string
) {
	return codexGatewayRequest<CodexDeviceLogin>(
		`${userPath(userId)}/login/device/start`,
		{
			method: 'POST',
			body: JSON.stringify({})
		}
	);
}

export async function getCodexDeviceLoginStatus(
	userId: string,
	loginId: string
) {
	return codexGatewayRequest<CodexDeviceLoginStatus>(
		`${userPath(userId)}/login/device/${encodeURIComponent(loginId)}`
	);
}

export async function getCodexAccount(
	userId: string
) {
	const payload = await codexGatewayRequest<{
		account: CodexGatewayAccount | null;
	}>(`${userPath(userId)}/account`);

	return payload.account;
}

export async function getCodexUsage(
	userId: string
) {
	return codexGatewayRequest<CodexUsage>(
		`${userPath(userId)}/rate-limits`
	);
}

export async function logoutCodexAccount(
	userId: string
) {
	await codexGatewayRequest<{ ok: true }>(
		`${userPath(userId)}/account`,
		{
			method: 'DELETE'
		}
	);
}

export async function sendCodexChat(
	userId: string,
	request: CodexChatRequest
) {
	return codexGatewayRequest<CodexChatResponse>(
		`${userPath(userId)}/chat`,
		{
			method: 'POST',
			body: JSON.stringify(request)
		}
	);
}
