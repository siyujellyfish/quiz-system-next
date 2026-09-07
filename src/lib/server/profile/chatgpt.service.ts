import type {
	CodexChatRequest,
	CodexDeviceLoginStatus,
	CodexSandboxAccount,
	CodexUsage
} from '$lib/server/integrations/codex-sandbox';

import {
	cancelCodexChat,
	CodexSandboxError,
	CodexSandboxNotFoundError,
	getCodexDeviceLoginStatus,
	getCodexSandboxName,
	getCodexUsage,
	isCodexSandboxConfigured,
	logoutCodexAccount,
	releaseCodexChatSession,
	sendCodexChatWithUsage,
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
	usageUpdatedAt: Date | null;
};

export class ChatgptNotConnectedError extends Error {
	constructor() {
		super('ChatGPT account is not connected');
		this.name = 'ChatgptNotConnectedError';
	}
}

export class ChatgptRelinkRequiredError
	extends ChatgptNotConnectedError {
	constructor() {
		super();
		this.name = 'ChatgptRelinkRequiredError';
		this.message =
			'ChatGPT account must be linked again';
	}
}

const ASK_AI_USAGE_REFRESH_INTERVAL_MS =
	60 * 1000;

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
			usageSnapshot?.fetchError ?? false,
		usageUpdatedAt:
			usageSnapshot?.updatedAt ?? null
	};
}

function shouldRefreshUsage(
	snapshot: Awaited<
		ReturnType<typeof getCodexUsageSnapshot>
	>
) {
	if (!snapshot || snapshot.fetchError) {
		return true;
	}

	return Date.now() - snapshot.updatedAt.getTime() >=
		ASK_AI_USAGE_REFRESH_INTERVAL_MS;
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

async function clearStoredChatgptState(
	userId: string
) {
	await Promise.all([
		deleteChatgptConnection(userId),
		deleteCodexUsageSnapshot(userId)
	]);
}

async function persistUsageAfterChat(input: {
	userId: string;
	usage: CodexUsage | null;
	usageError: boolean;
	usageAttempted: boolean;
}) {
	if (!input.usageAttempted) {
		return;
	}

	try {
		if (!input.usageError) {
			await upsertCodexUsageSnapshot(
				input.userId,
				input.usage,
				false
			);
			return;
		}

		const existingSnapshot =
			await getCodexUsageSnapshot(
				input.userId
			);

		await upsertCodexUsageSnapshot(
			input.userId,
			existingSnapshot?.usage ?? null,
			true
		);
	} catch (caughtError) {
		console.error(
			'Unable to persist Codex usage after AI turn',
			caughtError
		);
	}
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

export async function refreshChatgptCodexUsage(
	userId: string
): Promise<CodexUsage> {
	const connection = await getChatgptConnection(
		userId
	);

	if (!connection) {
		throw new ChatgptNotConnectedError();
	}

	try {
		const usage = await getCodexUsage(userId);

		await upsertCodexUsageSnapshot(
			userId,
			usage,
			false
		);

		return usage;
	} catch (caughtError) {
		if (
			caughtError instanceof
				CodexSandboxNotFoundError ||
			(
				caughtError instanceof
					CodexSandboxError &&
				caughtError.status === 409
			)
		) {
			await clearStoredChatgptState(userId);
			throw new ChatgptRelinkRequiredError();
		}

		const existingSnapshot =
			await getCodexUsageSnapshot(userId);

		await upsertCodexUsageSnapshot(
			userId,
			existingSnapshot?.usage ?? null,
			true
		);

		throw caughtError;
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

	await clearStoredChatgptState(userId);
}

export async function releaseChatgptMessageSession(
	userId: string
) {
	try {
		await releaseCodexChatSession(userId);
	} catch (caughtError) {
		if (
			caughtError instanceof
				CodexSandboxNotFoundError
		) {
			return;
		}

		throw caughtError;
	}
}

export async function cancelChatgptMessage(
	userId: string,
	generationId: string
) {
	const connection = await getChatgptConnection(
		userId
	);

	if (!connection) {
		throw new ChatgptNotConnectedError();
	}

	try {
		return await cancelCodexChat(
			userId,
			generationId
		);
	} catch (caughtError) {
		if (
			caughtError instanceof
				CodexSandboxNotFoundError
		) {
			await clearStoredChatgptState(userId);
			throw new ChatgptRelinkRequiredError();
		}

		throw caughtError;
	}
}

export async function sendChatgptMessage(
	userId: string,
	request: CodexChatRequest
) {
	const [
		connection,
		usageSnapshot
	] = await Promise.all([
		getChatgptConnection(userId),
		getCodexUsageSnapshot(userId)
	]);

	if (!connection) {
		throw new ChatgptNotConnectedError();
	}

	try {
		const response =
			await sendCodexChatWithUsage(
				userId,
				{
					...request,
					refreshUsage:
						shouldRefreshUsage(
							usageSnapshot
						),
					keepWarm: true
				}
			);

		await persistUsageAfterChat({
			userId,
			usage: response.usage,
			usageError: response.usageError,
			usageAttempted:
				response.usageAttempted
		});

		return {
			threadId: response.threadId,
			message: response.message,
			usageUpdated:
				response.usageAttempted
		};
	} catch (caughtError) {
		if (
			caughtError instanceof
				CodexSandboxNotFoundError ||
			(
				caughtError instanceof
					CodexSandboxError &&
				caughtError.status === 409
			)
		) {
			await clearStoredChatgptState(userId);
			throw new ChatgptRelinkRequiredError();
		}

		throw caughtError;
	}
}
