import {
	randomUUID
} from 'node:crypto';

import {
	eq
} from 'drizzle-orm';

import {
	fail,
	redirect
} from '@sveltejs/kit';

import type {
	Actions
} from './$types';

import { db } from '$lib/server/db';

import {
	users
} from '$lib/server/db/schema';

import {
	hashPassword
} from '$lib/server/auth/password';

import {
	createSession
} from '$lib/server/auth/session';

const usernamePattern =
	/^[a-zA-Z0-9_-]+$/;

export const actions: Actions = {
	default: async ({
		request,
		cookies
	}) => {
		const data =
			await request.formData();

		const username =
			String(
				data.get('username') ?? ''
			).trim();

		const password =
			String(
				data.get('password') ?? ''
			);

		const confirmPassword =
			String(
				data.get(
					'confirmPassword'
				) ?? ''
			);

		if (
			!username ||
			!password ||
			!confirmPassword
		) {
			return fail(400, {
				username,
				message:
					'請完成所有欄位'
			});
		}

		if (
			username.length < 3 ||
			username.length > 64
		) {
			return fail(400, {
				username,
				message:
					'使用者名稱必須介於 3 至 64 個字元'
			});
		}

		if (
			!usernamePattern.test(
				username
			)
		) {
			return fail(400, {
				username,
				message:
					'使用者名稱只能包含英文、數字、底線與連字號'
			});
		}

		if (
			password.length < 8 ||
			password.length > 128
		) {
			return fail(400, {
				username,
				message:
					'密碼必須介於 8 至 128 個字元'
			});
		}

		if (
			password !==
			confirmPassword
		) {
			return fail(400, {
				username,
				message:
					'兩次輸入的密碼不一致'
			});
		}

		const [existingUser] =
			await db
				.select({
					id: users.id
				})
				.from(users)
				.where(
					eq(
						users.username,
						username
					)
				)
				.limit(1);

		if (existingUser) {
			return fail(409, {
				username,
				message:
					'此使用者名稱無法使用'
			});
		}

		const passwordHash =
			await hashPassword(
				password
			);

		const userId =
			randomUUID();

		try {
			await db
				.insert(users)
				.values({
					id: userId,
					username,
					passwordHash
				});
		} catch (error) {
			console.error(
				'Failed to create user',
				error
			);

			return fail(500, {
				username,
				message:
					'建立帳號失敗，請稍後再試'
			});
		}

		await createSession(
			userId,
			cookies
		);

		redirect(
			303,
			'/'
		);
	}
};