import {
	asc,
	desc,
	eq
} from 'drizzle-orm';

import {
	db
} from '$lib/server/db';
import {
	users
} from '$lib/server/db/schema';

export type AdminUserListItem = {
	id: string;
	username: string;
	isAdmin: boolean;
};

export async function getAdminUsers(): Promise<
	AdminUserListItem[]
> {
	return db
		.select({
			id: users.id,
			username: users.username,
			isAdmin: users.isAdmin
		})
		.from(users)
		.orderBy(
			desc(users.isAdmin),
			asc(users.username)
		);
}

export async function getAdminUserByUsername(
	username: string
): Promise<AdminUserListItem | null> {
	const [user] = await db
		.select({
			id: users.id,
			username: users.username,
			isAdmin: users.isAdmin
		})
		.from(users)
		.where(
			eq(
				users.username,
				username
			)
		)
		.limit(1);

	return user ?? null;
}

export async function createAdminUser(input: {
	username: string;
	passwordHash: string;
	isAdmin: boolean;
}): Promise<AdminUserListItem> {
	const [user] = await db
		.insert(users)
		.values({
			username: input.username,
			passwordHash: input.passwordHash,
			isAdmin: input.isAdmin
		})
		.returning({
			id: users.id,
			username: users.username,
			isAdmin: users.isAdmin
		});

	if (!user) {
		throw new Error(
			'Failed to create managed user'
		);
	}

	return user;
}

export async function setAdminUserRole(
	userId: string,
	isAdmin: boolean
): Promise<AdminUserListItem | null> {
	const [user] = await db
		.update(users)
		.set({
			isAdmin
		})
		.where(
			eq(
				users.id,
				userId
			)
		)
		.returning({
			id: users.id,
			username: users.username,
			isAdmin: users.isAdmin
		});

	return user ?? null;
}

export async function deleteAdminUser(
	userId: string
): Promise<AdminUserListItem | null> {
	const [user] = await db
		.delete(users)
		.where(
			eq(
				users.id,
				userId
			)
		)
		.returning({
			id: users.id,
			username: users.username,
			isAdmin: users.isAdmin
		});

	return user ?? null;
}
