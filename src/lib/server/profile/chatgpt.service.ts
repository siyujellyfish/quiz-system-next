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
	getCodexUsage,
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
		usageAvailable: false,
		usageError
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

export async function getChatgptProfileConnection(
	userId: string
): Promise<ChatgptProfileConnection | null> {
	const storedConnection =
		await getChatgptConnection(userId);

	if (!isCodexSandboxConfigured()) {
		return storedConnection
			? profileFromStoredConnection(
				storedConnection,
				false
			)
			: null;
	}

	let account: CodexSandboxAccount | null;

	try {
		account = await getCodexAccount(userId);
	} catch (caughtError) {
		if (
			caughtError instanceof
			CodexSandboxNotFoundError
		) {
			if (storedConnection) {
				await deleteChatgptConnection(userId);
			}

			return null;
		}

		console.error(
			'Unable to load ChatGPT account from Vercel Sandbox',
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

	const connection = await persistCodexAccount(
		userId,
		account
	);

	try {
		const usage = await getCodexUsage(userId);
		const usageAvailable =
			usage.primary !== null ||
			usage.secondary !== null;

		return {
			displayName:
				connection.displayName ??
				connection.email ??
				'ChatGPT 使用者',
			email: connection.email,
			planType: connection.planType,
			usage,
			usageAvailable,
			usageError: false
		};
	} catch (caughtError) {
		if (
			caughtError instanceof
			CodexSandboxNotFoundError
		) {
			await deleteChatgptConnection(userId);
			return null;
		}

		console.error(
			'Unable to load Codex usage from Vercel Sandbox',
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
