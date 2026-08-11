import {
	fail,
	redirect
} from '@sveltejs/kit';

import type {
	Actions
} from './$types';

import {
	authenticateUser
} from '$lib/server/auth/user';

import {
	createSession
} from '$lib/server/auth/session';

function getSafeRedirect(
	value: string | null,
	origin: string
): string {
	if (
		!value ||
		!value.startsWith('/') ||
		value.startsWith('//')
	) {
		return '/';
	}

	try {
		const target = new URL(
			value,
			origin
		);

		if (target.origin !== origin) {
			return '/';
		}

		return (
			target.pathname +
			target.search +
			target.hash
		);
	} catch {
		return '/';
	}
}

export const actions: Actions = {
	default: async ({
		request,
		cookies,
		url
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

		if (!username || !password) {
			return fail(400, {
				username,
				message:
					'請輸入使用者名稱與密碼'
			});
		}

		const user =
			await authenticateUser(
				username,
				password
			);

		if (!user) {
			return fail(400, {
				username,
				message:
					'使用者名稱或密碼錯誤'
			});
		}

		await createSession(
			user.id,
			cookies
		);

		const redirectTo =
			getSafeRedirect(
				url.searchParams.get(
					'redirectTo'
				),
				url.origin
			);

		redirect(
			303,
			redirectTo
		);
	}
};