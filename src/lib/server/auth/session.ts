import { dev } from '$app/environment';

import {
	createHash,
	randomBytes
} from 'node:crypto';

import {
	eq
} from 'drizzle-orm';

import type {
	Cookies
} from '@sveltejs/kit';

import type {
	SessionUser
} from '$lib/types/auth';

import { db } from '$lib/server/db';

import {
	userSessions,
	users
} from '$lib/server/db/schema';

export const SESSION_COOKIE_NAME =
	'quiz_session';

const SESSION_DURATION_SECONDS =
	60 * 60 * 24 * 30;

function createSessionToken(): string {
	return randomBytes(32)
		.toString('base64url');
}

function hashSessionToken(
	token: string
): string {
	return createHash('sha256')
		.update(token, 'utf8')
		.digest('hex');
}

function getSessionExpiresAt(): Date {
	return new Date(
		Date.now() +
			SESSION_DURATION_SECONDS * 1000
	);
}

export async function createSession(
	userId: string,
	cookies: Cookies
): Promise<void> {
	const token = createSessionToken();

	const tokenHash =
		hashSessionToken(token);

	const expiresAt =
		getSessionExpiresAt();

	await db.insert(userSessions)
		.values({
			tokenHash,
			userId,
			expiresAt
		});

	cookies.set(
		SESSION_COOKIE_NAME,
		token,
		{
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev,
			maxAge: SESSION_DURATION_SECONDS
		}
	);
}

export async function getSessionUser(
	cookies: Cookies
): Promise<SessionUser | null> {
	const token = cookies.get(
		SESSION_COOKIE_NAME
	);

	if (!token) {
		return null;
	}

	const tokenHash =
		hashSessionToken(token);

	const [result] = await db
		.select({
			tokenHash: userSessions.tokenHash,
			expiresAt: userSessions.expiresAt,

			userId: users.id,
			username: users.username,
			isAdmin: users.isAdmin
		})
		.from(userSessions)
		.innerJoin(
			users,
			eq(
				userSessions.userId,
				users.id
			)
		)
		.where(
			eq(
				userSessions.tokenHash,
				tokenHash
			)
		)
		.limit(1);

	if (!result) {
		cookies.delete(
			SESSION_COOKIE_NAME,
			{
				path: '/'
			}
		);

		return null;
	}

	if (
		result.expiresAt.getTime() <=
		Date.now()
	) {
		await db
			.delete(userSessions)
			.where(
				eq(
					userSessions.tokenHash,
					tokenHash
				)
			);

		cookies.delete(
			SESSION_COOKIE_NAME,
			{
				path: '/'
			}
		);

		return null;
	}

	return {
		id: result.userId,
		username: result.username,
		isAdmin: result.isAdmin
	};
}

export async function deleteSession(
	cookies: Cookies
): Promise<void> {
	const token = cookies.get(
		SESSION_COOKIE_NAME
	);

	if (token) {
		const tokenHash =
			hashSessionToken(token);

		await db
			.delete(userSessions)
			.where(
				eq(
					userSessions.tokenHash,
					tokenHash
				)
			);
	}

	cookies.delete(
		SESSION_COOKIE_NAME,
		{
			path: '/'
		}
	);
}
