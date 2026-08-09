import {
	and,
	eq,
	ne
} from 'drizzle-orm';

import {
	db
} from '$lib/server/db';

import {
	userSessions,
	users
} from '$lib/server/db/schema';

export async function getAccountPasswordHash(
	userId: string
) {
	const [user] = await db
		.select({
			passwordHash: users.passwordHash
		})
		.from(users)
		.where(
			eq(
				users.id,
				userId
			)
		)
		.limit(1);

	return user ?? null;
}

export async function updateAccountPassword(
	userId: string,
	currentPasswordHash: string,
	newPasswordHash: string,
	currentSessionTokenHash: string
) {
	return db.transaction(async (tx) => {
		const [updated] = await tx
			.update(users)
			.set({
				passwordHash: newPasswordHash
			})
			.where(
				and(
					eq(
						users.id,
						userId
					),
					eq(
						users.passwordHash,
						currentPasswordHash
					)
				)
			)
			.returning({
				id: users.id
			});

		if (!updated) {
			return false;
		}

		await tx
			.delete(userSessions)
			.where(
				and(
					eq(
						userSessions.userId,
						userId
					),
					ne(
						userSessions.tokenHash,
						currentSessionTokenHash
					)
				)
			);

		return true;
	});
}
