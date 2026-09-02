import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes
} from 'node:crypto';

import {
	env
} from '$env/dynamic/private';

const TOKEN_VERSION = 'v1';
const TOKEN_IV_BYTES = 12;
const CHATGPT_DEFAULT_SCOPE =
	'openid profile email offline_access';

export type ChatgptOAuthConfig = {
	authorizeUrl: string;
	tokenUrl: string;
	userInfoUrl: string;
	clientId: string;
	clientSecret: string | null;
	scope: string;
	usageUrl: string | null;
};

export type ChatgptTokenResponse = {
	accessToken: string;
	refreshToken: string | null;
	expiresIn: number | null;
	scope: string | null;
	idToken: string | null;
};

export type ChatgptUserInfo = {
	id: string;
	displayName: string | null;
	email: string | null;
};

export type CodexUsageWindow = {
	usedPercent: number;
	windowMinutes: number | null;
	resetsAt: string | null;
};

export type CodexUsage = {
	primary: CodexUsageWindow | null;
	secondary: CodexUsageWindow | null;
};

export type PkcePair = {
	verifier: string;
	challenge: string;
};

function getEncryptionKey() {
	const encodedKey =
		env.CHATGPT_TOKEN_ENCRYPTION_KEY;

	if (!encodedKey) {
		throw new Error(
			'CHATGPT_TOKEN_ENCRYPTION_KEY is not set'
		);
	}

	const key = Buffer.from(
		encodedKey,
		'base64'
	);

	if (key.length !== 32) {
		throw new Error(
			'CHATGPT_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key'
		);
	}

	return key;
}

function normalizeOptionalString(
	value: string | undefined
) {
	const normalized = value?.trim();
	return normalized ? normalized : null;
}

export function getChatgptOAuthConfig():
	ChatgptOAuthConfig | null {
	const authorizeUrl = normalizeOptionalString(
		env.CHATGPT_OAUTH_AUTHORIZE_URL
	);
	const tokenUrl = normalizeOptionalString(
		env.CHATGPT_OAUTH_TOKEN_URL
	);
	const userInfoUrl = normalizeOptionalString(
		env.CHATGPT_OAUTH_USERINFO_URL
	);
	const clientId = normalizeOptionalString(
		env.CHATGPT_OAUTH_CLIENT_ID
	);
	const encryptionKey = normalizeOptionalString(
		env.CHATGPT_TOKEN_ENCRYPTION_KEY
	);

	if (
		!authorizeUrl ||
		!tokenUrl ||
		!userInfoUrl ||
		!clientId ||
		!encryptionKey
	) {
		return null;
	}

	return {
		authorizeUrl,
		tokenUrl,
		userInfoUrl,
		clientId,
		clientSecret: normalizeOptionalString(
			env.CHATGPT_OAUTH_CLIENT_SECRET
		),
		scope:
			normalizeOptionalString(
				env.CHATGPT_OAUTH_SCOPE
			) ?? CHATGPT_DEFAULT_SCOPE,
		usageUrl: normalizeOptionalString(
			env.CHATGPT_CODEX_USAGE_URL
		)
	};
}

export function generateOAuthState() {
	return randomBytes(32).toString('base64url');
}

export function generatePkcePair(): PkcePair {
	const verifier =
		randomBytes(48).toString('base64url');
	const challenge = createHash('sha256')
		.update(verifier)
		.digest('base64url');

	return {
		verifier,
		challenge
	};
}

export function buildChatgptAuthorizeUrl(
	config: ChatgptOAuthConfig,
	redirectUri: string,
	state: string,
	challenge: string
) {
	const url = new URL(config.authorizeUrl);

	url.searchParams.set(
		'response_type',
		'code'
	);
	url.searchParams.set(
		'client_id',
		config.clientId
	);
	url.searchParams.set(
		'redirect_uri',
		redirectUri
	);
	url.searchParams.set(
		'scope',
		config.scope
	);
	url.searchParams.set(
		'state',
		state
	);
	url.searchParams.set(
		'code_challenge',
		challenge
	);
	url.searchParams.set(
		'code_challenge_method',
		'S256'
	);

	return url.toString();
}

function parseTokenResponse(
	payload: unknown
): ChatgptTokenResponse {
	if (
		typeof payload !== 'object' ||
		payload === null
	) {
		throw new Error(
			'ChatGPT token response is invalid'
		);
	}

	const data = payload as Record<string, unknown>;
	const accessToken = data.access_token;

	if (typeof accessToken !== 'string') {
		throw new Error(
			'ChatGPT token response is missing access_token'
		);
	}

	return {
		accessToken,
		refreshToken:
			typeof data.refresh_token === 'string'
				? data.refresh_token
				: null,
		expiresIn:
			typeof data.expires_in === 'number' &&
			Number.isFinite(data.expires_in)
				? data.expires_in
				: null,
		scope:
			typeof data.scope === 'string'
				? data.scope
				: null,
		idToken:
			typeof data.id_token === 'string'
				? data.id_token
				: null
	};
}

async function postTokenRequest(
	config: ChatgptOAuthConfig,
	body: URLSearchParams
) {
	if (config.clientSecret) {
		body.set(
			'client_secret',
			config.clientSecret
		);
	}

	const response = await fetch(
		config.tokenUrl,
		{
			method: 'POST',
			headers: {
				'content-type':
					'application/x-www-form-urlencoded',
				'accept': 'application/json'
			},
			body
		}
	);

	if (!response.ok) {
		throw new Error(
			`ChatGPT token request failed (${response.status})`
		);
	}

	return parseTokenResponse(
		await response.json()
	);
}

export async function exchangeChatgptCode(
	config: ChatgptOAuthConfig,
	code: string,
	redirectUri: string,
	verifier: string
) {
	const body = new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		redirect_uri: redirectUri,
		client_id: config.clientId,
		code_verifier: verifier
	});

	return postTokenRequest(
		config,
		body
	);
}

export async function refreshChatgptToken(
	config: ChatgptOAuthConfig,
	refreshToken: string
) {
	const body = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token: refreshToken,
		client_id: config.clientId
	});

	return postTokenRequest(
		config,
		body
	);
}

export async function fetchChatgptUserInfo(
	config: ChatgptOAuthConfig,
	accessToken: string
): Promise<ChatgptUserInfo> {
	const response = await fetch(
		config.userInfoUrl,
		{
			headers: {
				authorization:
					`Bearer ${accessToken}`,
				accept: 'application/json'
			}
		}
	);

	if (!response.ok) {
		throw new Error(
			`ChatGPT user info request failed (${response.status})`
		);
	}

	const payload = await response.json();

	if (
		typeof payload !== 'object' ||
		payload === null
	) {
		throw new Error(
			'ChatGPT user info response is invalid'
		);
	}

	const data = payload as Record<string, unknown>;
	const id = data.sub;

	if (typeof id !== 'string' || !id) {
		throw new Error(
			'ChatGPT user info response is missing sub'
		);
	}

	const displayName = [
		data.preferred_username,
		data.name
	].find(
		(value): value is string =>
			typeof value === 'string' &&
			value.trim().length > 0
	) ?? null;

	return {
		id,
		displayName,
		email:
			typeof data.email === 'string' &&
			data.email.trim()
				? data.email
				: null
	};
}

export function encryptChatgptToken(
	token: string
) {
	const iv = randomBytes(TOKEN_IV_BYTES);
	const cipher = createCipheriv(
		'aes-256-gcm',
		getEncryptionKey(),
		iv
	);
	const encrypted = Buffer.concat([
		cipher.update(
			token,
			'utf8'
		),
		cipher.final()
	]);
	const authTag = cipher.getAuthTag();

	return [
		TOKEN_VERSION,
		iv.toString('base64url'),
		authTag.toString('base64url'),
		encrypted.toString('base64url')
	].join('.');
}

export function decryptChatgptToken(
	value: string
) {
	const [
		version,
		ivEncoded,
		authTagEncoded,
		encryptedEncoded
	] = value.split('.');

	if (
		version !== TOKEN_VERSION ||
		!ivEncoded ||
		!authTagEncoded ||
		!encryptedEncoded
	) {
		throw new Error(
			'Encrypted ChatGPT token is invalid'
		);
	}

	const decipher = createDecipheriv(
		'aes-256-gcm',
		getEncryptionKey(),
		Buffer.from(
			ivEncoded,
			'base64url'
		)
	);
	decipher.setAuthTag(
		Buffer.from(
			authTagEncoded,
			'base64url'
		)
	);

	return Buffer.concat([
		decipher.update(
			Buffer.from(
				encryptedEncoded,
				'base64url'
			)
		),
		decipher.final()
	]).toString('utf8');
}

export function getTokenExpiresAt(
	expiresIn: number | null
) {
	if (expiresIn === null) {
		return null;
	}

	return new Date(
		Date.now() + expiresIn * 1000
	);
}

function asObject(
	value: unknown
): Record<string, unknown> | null {
	return typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value)
		? value as Record<string, unknown>
		: null;
}

function readFiniteNumber(
	object: Record<string, unknown>,
	...keys: string[]
) {
	for (const key of keys) {
		const value = object[key];

		if (
			typeof value === 'number' &&
			Number.isFinite(value)
		) {
			return value;
		}
	}

	return null;
}

function parseUsageWindow(
	value: unknown
): CodexUsageWindow | null {
	const window = asObject(value);

	if (!window) {
		return null;
	}

	const usedPercent = readFiniteNumber(
		window,
		'used_percent',
		'usedPercent'
	);

	if (usedPercent === null) {
		return null;
	}

	const windowMinutes = readFiniteNumber(
		window,
		'window_minutes',
		'windowMinutes'
	) ?? (() => {
		const seconds = readFiniteNumber(
			window,
			'limit_window_seconds',
			'limitWindowSeconds'
		);

		return seconds === null
			? null
			: seconds / 60;
	})();
	const resetAt = readFiniteNumber(
		window,
		'reset_at',
		'resetAt'
	);

	return {
		usedPercent: Math.min(
			100,
			Math.max(0, usedPercent)
		),
		windowMinutes,
		resetsAt: resetAt === null
			? null
			: new Date(
				resetAt * 1000
			).toISOString()
	};
}

function findRateLimitObject(
	payload: Record<string, unknown>
) {
	const direct = asObject(
		payload.rate_limit ??
		payload.rateLimit
	);

	if (direct) {
		return direct;
	}

	const collections = [
		asObject(payload.rate_limits),
		asObject(payload.rateLimits),
		asObject(payload.rate_limits_by_limit_id),
		asObject(payload.rateLimitsByLimitId)
	];

	for (const collection of collections) {
		if (!collection) {
			continue;
		}

		const codex = asObject(
			collection.codex
		);

		if (codex) {
			return codex;
		}
	}

	return payload;
}

export function parseCodexUsage(
	payload: unknown
): CodexUsage {
	const root = asObject(payload);

	if (!root) {
		throw new Error(
			'Codex usage response is invalid'
		);
	}

	const rateLimit = findRateLimitObject(root);
	const primary = parseUsageWindow(
		rateLimit.primary_window ??
		rateLimit.primaryWindow ??
		rateLimit.primary
	);
	const secondary = parseUsageWindow(
		rateLimit.secondary_window ??
		rateLimit.secondaryWindow ??
		rateLimit.secondary
	);

	if (!primary && !secondary) {
		throw new Error(
			'Codex usage response does not contain rate-limit windows'
		);
	}

	return {
		primary,
		secondary
	};
}

export async function fetchCodexUsage(
	config: ChatgptOAuthConfig,
	accessToken: string
): Promise<CodexUsage | null> {
	if (!config.usageUrl) {
		return null;
	}

	const response = await fetch(
		config.usageUrl,
		{
			headers: {
				authorization:
					`Bearer ${accessToken}`,
				accept: 'application/json'
			}
		}
	);

	if (!response.ok) {
		throw new Error(
			`Codex usage request failed (${response.status})`
		);
	}

	return parseCodexUsage(
		await response.json()
	);
}
