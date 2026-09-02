import type {
	CodexChatRequest,
	CodexDeviceLoginStatus,
	CodexGatewayAccount,
	CodexUsage
} from '$lib/server/integrations/codex-gateway';

import {
	getCodexAccount,
	getCodexDeviceLoginStatus,
	getCodexUsage,
	isCodexGatewayConfigured,
	logoutCodexAccount,
	sendCodexChat,
	startCodexDeviceLogin
} from '$lib/server/integrations/codex-gateway';

import {
	deleteChatgptConnection,
	getChatgptConnection,
	upsertChatgptConnection
} from './external-account.repository';

export type ChatgptProfileConnection = {
	displayName: string;
	email: string | null;
	planType: string | null;
	usage: CodexUsage | null;
	usageAvailable: boolean;
	usageError: boolean;
};

export class ChatgptNotConnectedError extends Error {
	constructor() {
		super('ChatGPT account is not connected');
		this.name = 'ChatgptNotConnectedError';
	}
}

function profileFromStoredConnection(
	connection: NonNullable<
		Awaited<ReturnType<typeof getChatgptConnection>>
	>,
	usageError: boolean
): ChatgptProfileConnection {
	return {
		displayName:
			connection.displayName ??
			connection.email ??
			'ChatGPT 使用者',
		email: connection.email,
		planType: connection.planType,
		usage: null,
		usageAvailable: usageError,
		usageError
	};
}

async function persistGatewayAccount(
	userId: string,
	account: CodexGatewayAccount
) {
	const providerAccountId =
		account.email ?? `codex:${userId}`;

	return upsertChatgptConnection({
		userId,
		providerAccountId,
		displayName:
			account.email ?? 'ChatGPT 使用者',
		email: account.email,
		planType: account.planType,
		codexProfileId: userId
	});
}

export function isChatgptConnectionConfigured() {
	return isCodexGatewayConfigured();
}

export async function startChatgptDeviceLogin(
	userId: string
) {
	return startCodexDeviceLogin(userId);
}

export async function getChatgptDeviceLoginStatus(
	userId: string,
	loginId: string
): Promise<CodexDeviceLoginStatus> {
	const status = await getCodexDeviceLoginStatus(
		userId,
		loginId
	);

	if (status.status !== 'succeeded') {
		return status;
	}

	const account =
		status.account ?? await getCodexAccount(userId);

	if (!account) {
		return {
			status: 'failed',
			error: 'ChatGPT 授權完成，但無法讀取帳號資訊。',
			account: null
		};
	}

	await persistGatewayAccount(
		userId,
		account
	);

	return {
		status: 'succeeded',
		error: null,
		account
	};
}

export async function getChatgptProfileConnection(
	userId: string
): Promise<ChatgptProfileConnection | null> {
	const storedConnection =
		await getChatgptConnection(userId);

	if (!isCodexGatewayConfigured()) {
		return storedConnection
			? profileFromStoredConnection(
				storedConnection,
				false
			)
			: null;
	}

	let account: CodexGatewayAccount | null;

	try {
		account = await getCodexAccount(userId);
	} catch (caughtError) {
		console.error(
			'Unable to load ChatGPT account from Codex Gateway',
			caughtError
		);

		return storedConnection
			? profileFromStoredConnection(
				storedConnection,
				true
			)
			: null;
	}

	if (!account) {
		if (storedConnection) {
			await deleteChatgptConnection(userId);
		}

		return null;
	}

	const connection = await persistGatewayAccount(
		userId,
		account
	);

	try {
		const usage = await getCodexUsage(userId);

		return {
			displayName:
				connection.displayName ??
				connection.email ??
				'ChatGPT 使用者',
			email: connection.email,
			planType: connection.planType,
			usage,
			usageAvailable: true,
			usageError: false
		};
	} catch (caughtError) {
		console.error(
			'Unable to load Codex usage from Codex Gateway',
			caughtError
		);

		return profileFromStoredConnection(
			connection,
			true
		);
	}
}

export async function disconnectChatgptAccount(
	userId: string
) {
	if (!isCodexGatewayConfigured()) {
		throw new Error(
			'Codex Gateway is not configured; refusing to remove local metadata without logging out the persisted Codex profile'
		);
	}

	await logoutCodexAccount(userId);
	await deleteChatgptConnection(userId);
}

export async function sendChatgptMessage(
	userId: string,
	request: CodexChatRequest
) {
	const connection = await getChatgptConnection(
		userId
	);

	if (!connection) {
		throw new ChatgptNotConnectedError();
	}

	return sendCodexChat(
		userId,
		request
	);
}
