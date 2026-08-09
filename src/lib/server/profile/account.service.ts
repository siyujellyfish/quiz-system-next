import {
	hashPassword,
	verifyPassword
} from '$lib/server/auth/password';

import {
	getAccountPasswordHash,
	updateAccountPassword
} from '$lib/server/profile/account.repository';

export class InvalidCurrentPasswordError extends Error {
	constructor() {
		super('目前密碼不正確');
		this.name = 'InvalidCurrentPasswordError';
	}
}

export class AccountNotFoundError extends Error {
	constructor() {
		super('找不到目前帳號');
		this.name = 'AccountNotFoundError';
	}
}

export class AccountPasswordConflictError extends Error {
	constructor() {
		super('密碼已被其他操作變更，請重新整理後再試');
		this.name = 'AccountPasswordConflictError';
	}
}

export async function changeAccountPassword(input: {
	userId: string;
	currentSessionTokenHash: string;
	currentPassword: string;
	newPassword: string;
}) {
	const account = await getAccountPasswordHash(
		input.userId
	);

	if (!account) {
		throw new AccountNotFoundError();
	}

	const currentPasswordValid =
		await verifyPassword(
			account.passwordHash,
			input.currentPassword
		);

	if (!currentPasswordValid) {
		throw new InvalidCurrentPasswordError();
	}

	const newPasswordHash = await hashPassword(
		input.newPassword
	);

	const updated = await updateAccountPassword(
		input.userId,
		account.passwordHash,
		newPasswordHash,
		input.currentSessionTokenHash
	);

	if (!updated) {
		throw new AccountPasswordConflictError();
	}
}
