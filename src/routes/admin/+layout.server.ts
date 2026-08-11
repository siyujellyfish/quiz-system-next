import type {
	LayoutServerLoad
} from './$types';

import {
	requireAdmin
} from '$lib/server/auth/admin';

export const load: LayoutServerLoad =
	async ({ locals, url }) => {
		return {
			user: requireAdmin(
				locals.user,
				url.pathname
			)
		};
	};
