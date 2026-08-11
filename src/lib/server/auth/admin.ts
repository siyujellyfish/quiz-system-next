import {
	error,
	redirect
} from '@sveltejs/kit';

import type {
	SessionUser
} from '$lib/types/auth';

export function requireAdmin(
	user: SessionUser | null,
	redirectTo = '/admin'
): SessionUser {
	if (!user) {
		redirect(
			303,
			`/login?redirectTo=${encodeURIComponent(
				redirectTo
			)}`
		);
	}

	if (!user.isAdmin) {
		error(
			403,
			'沒有權限存取管理後台'
		);
	}

	return user;
}
