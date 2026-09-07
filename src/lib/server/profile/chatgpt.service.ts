import type {
	CodexChatRequest,
	CodexDeviceLoginStatus,
	CodexSandboxAccount,
	CodexUsage
} from '$lib/server/integrations/codex-sandbox';

import {
	CodexSandboxNotFoundError,
	getCodexDeviceLoginStatus,
	getCodexSandboxName,
	getCodexUsage,
	isCodexSandboxConfigured,
	logoutCodexAccount,
	sendCodexChat,
	startCodexDeviceLogin
} from '$lib/server/integrations/codex-sandbox';

import {
	deleteCodexUsageSnapshot,
	getCodexUsageSnapshot,
	upsertCodexUsageSnapshot
} from './codex-usage.repository';
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
	usageSnapshot: Awaited<
		ReturnType<typeof getCodexUsageSnapshot>
	>
): ChatgptProfileConnection {
	const usage = usageSnapshot?.usage ?? null;
	const usageAvailable = Boolean(
		usage?.primary || usage?.secondary
	);

	return {
		displayName:
			connection.displayName ??
			connection.email ??
			'ChatGPT 使用者',
		email: connection.email,
		planType: connection.planType,
		usage,
		usageAvailable,
		usageError:
			usageSnapshot?.fetchError ?? false
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

	// A successful device-code notification is not enough by itself.
	// Only persist a connection when Codex has also returned a concrete
	// ChatGPT account from account/read.
	const account = status.account;

	if (!account) {
		return {
			status: 'failed',
			error: 'ChatGPT 授權完成，但無法讀取帳號資訊。',
			account: null
		};
	}

	let usage: CodexUsage | null = null;
	let usageError = false;

	try {
		usage = await getCodexUsage(userId);
	} catch (caughtError) {
		usageError = true;
		console.error(
			'Unable to read Codex usage after confirmed ChatGPT login',
			caughtError
		);
	}

	// The database is the durable record of a completed connection, never
	// of an in-progress or failed authorization attempt.
	await persistCodexAccount(
		userId,
		account
	);
	await upsertCodexUsageSnapshot(
		userId,
		usage,
		usageError
	);

	return {
		status: 'succeeded',
		error: null,
		account
	};
}

/**
 * Profile navigation must stay fast and deterministic. Do not resume a
 * persistent Vercel Sandbox from a page load; only read the connection and
 * latest Codex usage snapshot persisted after a confirmed device-code login.
 */
export async function getChatgptProfileConnection(
	userId: string
): Promise<ChatgptProfileConnection | null> {
	const [
		storedConnection,
		usageSnapshot
	] = await Promise.all([
		getChatgptConnection(userId),
		getCodexUsageSnapshot(userId)
	]);

	return storedConnection
		? profileFromStoredConnection(
			storedConnection,
			usageSnapshot
		)
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

	await Promise.all([
		deleteChatgptConnection(userId),
		deleteCodexUsageSnapshot(userId)
	]);
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
			await Promise.all([
				deleteChatgptConnection(userId),
				deleteCodexUsageSnapshot(userId)
			]);
			throw new ChatgptNotConnectedError();
		}

		throw caughtError;
	}
}
