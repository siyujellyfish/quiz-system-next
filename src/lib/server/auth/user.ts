import {
	eq
} from 'drizzle-orm';

import { db } from '$lib/server/db';

import {
	users
} from '$lib/server/db/schema';

import {
	hashPassword,
	verifyPassword
} from './password';

export type AuthenticatedUser = {
	id: string;
	username: string;
};

let dummyHashPromise:
	| Promise<string>
	| null = null;

function getDummyHash(): Promise<string> {
	dummyHashPromise ??=
		hashPassword(
			'dummy-password-for-timing-only'
		);

	return dummyHashPromise;
}

export async function authenticateUser(
	username: string,
	password: string
): Promise<AuthenticatedUser | null> {
	const [user] = await db
		.select({
			id: users.id,
			username: users.username,
			passwordHash: users.passwordHash
		})
		.from(users)
		.where(
			eq(
				users.username,
				username
			)
		)
		.limit(1);

	const passwordHash = user
		? user.passwordHash
		: await getDummyHash();

	const valid =
		await verifyPassword(
			passwordHash,
			password
		);

	if (!user || !valid) {
		return null;
	}

	return {
		id: user.id,
		username: user.username
	};
}