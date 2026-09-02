import type {
	ChatgptOAuthConfig,
	CodexUsage
} from '$lib/server/integrations/chatgpt';

import {
	decryptChatgptToken,
	encryptChatgptToken,
	exchangeChatgptCode,
	fetchChatgptUserInfo,
	fetchCodexUsage,
	getChatgptOAuthConfig,
	getTokenExpiresAt,
	refreshChatgptToken
} from '$lib/server/integrations/chatgpt';

import {
	deleteChatgptConnection,
	getChatgptConnection,
	upsertChatgptConnection
} from './external-account.repository';

const TOKEN_REFRESH_SKEW_MS = 60_000;

export type ChatgptProfileConnection = {
	displayName: string;
	email: string | null;
	usage: CodexUsage | null;
	usageAvailable: boolean;
	usageError: boolean;
};

function shouldRefreshToken(
	expiresAt: Date | null
) {
	return expiresAt !== null &&
		expiresAt.getTime() <=
			Date.now() + TOKEN_REFRESH_SKEW_MS;
}

async function getCurrentAccessToken(
	config: ChatgptOAuthConfig,
	connection: NonNullable<
		Awaited<ReturnType<typeof getChatgptConnection>>
	>
) {
	if (!shouldRefreshToken(connection.tokenExpiresAt)) {
		return decryptChatgptToken(
			connection.accessTokenEncrypted
		);
	}

	if (!connection.refreshTokenEncrypted) {
		throw new Error(
			'ChatGPT access token has expired and no refresh token is available'
		);
	}

	const previousRefreshToken = decryptChatgptToken(
		connection.refreshTokenEncrypted
	);
	const refreshed = await refreshChatgptToken(
		config,
		previousRefreshToken
	);
	const nextRefreshToken =
		refreshed.refreshToken ??
		previousRefreshToken;

	await upsertChatgptConnection({
		userId: connection.userId,
		providerAccountId:
			connection.providerAccountId,
		displayName: connection.displayName,
		email: connection.email,
		accessTokenEncrypted: encryptChatgptToken(
			refreshed.accessToken
		),
		refreshTokenEncrypted: encryptChatgptToken(
			nextRefreshToken
		),
		scope:
			refreshed.scope ?? connection.scope,
		tokenExpiresAt: getTokenExpiresAt(
			refreshed.expiresIn
		)
	});

	return refreshed.accessToken;
}

export function isChatgptConnectionConfigured() {
	return getChatgptOAuthConfig() !== null;
}

export async function connectChatgptAccount(
	userId: string,
	code: string,
	redirectUri: string,
	verifier: string
) {
	const config = getChatgptOAuthConfig();

	if (!config) {
		throw new Error(
			'ChatGPT OAuth is not configured'
		);
	}

	const tokens = await exchangeChatgptCode(
		config,
		code,
		redirectUri,
		verifier
	);
	const userInfo = await fetchChatgptUserInfo(
		config,
		tokens.accessToken
	);

	return upsertChatgptConnection({
		userId,
		providerAccountId: userInfo.id,
		displayName: userInfo.displayName,
		email: userInfo.email,
		accessTokenEncrypted: encryptChatgptToken(
			tokens.accessToken
		),
		refreshTokenEncrypted: tokens.refreshToken
			? encryptChatgptToken(
				tokens.refreshToken
			)
			: null,
		scope: tokens.scope,
		tokenExpiresAt: getTokenExpiresAt(
			tokens.expiresIn
		)
	});
}

export async function getChatgptProfileConnection(
	userId: string
): Promise<ChatgptProfileConnection | null> {
	const connection = await getChatgptConnection(
		userId
	);

	if (!connection) {
		return null;
	}

	const displayName =
		connection.displayName ??
		connection.email ??
		connection.providerAccountId;
	const config = getChatgptOAuthConfig();

	if (!config || !config.usageUrl) {
		return {
			displayName,
			email: connection.email,
			usage: null,
			usageAvailable: false,
			usageError: false
		};
	}

	try {
		const accessToken = await getCurrentAccessToken(
			config,
			connection
		);
		const usage = await fetchCodexUsage(
			config,
			accessToken
		);

		return {
			displayName,
			email: connection.email,
			usage,
			usageAvailable: usage !== null,
			usageError: false
		};
	} catch (error) {
		console.error(
			'Unable to load Codex usage',
			error
		);

		return {
			displayName,
			email: connection.email,
			usage: null,
			usageAvailable: true,
			usageError: true
		};
	}
}

export async function disconnectChatgptAccount(
	userId: string
) {
	await deleteChatgptConnection(userId);
}
