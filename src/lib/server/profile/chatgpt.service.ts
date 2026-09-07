import type {
	CodexChatRequest,
	CodexDeviceLoginStatus,
	CodexSandboxAccount,
	CodexUsage
} from '$lib/server/integrations/codex-sandbox';

import {
	CodexSandboxNotFoundError,
	getCodexAccount,
	getCodexDeviceLoginStatus,
	getCodexSandboxName,
	isCodexSandboxConfigured,
	logoutCodexAccount,
	sendCodexChat,
	startCodexDeviceLogin
} from '$lib/server/integrations/codex-sandbox';

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
	>
): ChatgptProfileConnection {
	return {
		displayName:
			connection.displayName ??
			connection.email ??
			'ChatGPT 使用者',
		email: connection.email,
		planType: connection.planType,
		usage: null,
		usageAvailable: false,
		usageError: false
	};
}

async function persistCodexAccount(
	userId: string,
	account: CodexSandboxAccount
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
		codexProfileId:
			getCodexSandboxName(userId)
	});
}

export function isChatgptConnectionConfigured() {
	return isCodexSandboxConfigured();
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

	await persistCodexAccount(
		userId,
		account
	);

	return {
		status: 'succeeded',
		error: null,
		account
	};
}

/**
 * Profile navigation must stay fast and deterministic. Do not resume a
 * persistent Vercel Sandbox from a page load; only read the connection
 * metadata that was persisted after a successful device-code login.
 */
export async function getChatgptProfileConnection(
	userId: string
): Promise<ChatgptProfileConnection | null> {
	const storedConnection =
		await getChatgptConnection(userId);

	return storedConnection
		? profileFromStoredConnection(storedConnection)
		: null;
}

export async function disconnectChatgptAccount(
	userId: string
) {
	if (!isCodexSandboxConfigured()) {
		throw new Error(
			'Vercel Sandbox is not configured; refusing to remove local metadata without deleting the persisted Codex sandbox'
		);
	}

	try {
		await logoutCodexAccount(userId);
	} catch (caughtError) {
		if (
			!(caughtError instanceof
				CodexSandboxNotFoundError)
		) {
			throw caughtError;
		}
	}

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

	try {
		return await sendCodexChat(
			userId,
			request
		);
	} catch (caughtError) {
		if (
			caughtError instanceof
			CodexSandboxNotFoundError
		) {
			await deleteChatgptConnection(userId);
			throw new ChatgptNotConnectedError();
		}

		throw caughtError;
	}
}
