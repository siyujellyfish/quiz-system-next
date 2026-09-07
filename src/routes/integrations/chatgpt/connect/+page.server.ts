import {
	error,
	redirect
} from '@sveltejs/kit';

import type {
	PageServerLoad
} from './$types';

import {
	getChatgptProfileConnection,
	isChatgptConnectionConfigured
} from '$lib/server/profile/chatgpt.service';

export const load: PageServerLoad = async ({
	locals
}) => {
	if (!locals.user) {
		redirect(
			303,
			`/login?redirectTo=${encodeURIComponent(
				'/profile'
			)}`
		);
	}

	if (!isChatgptConnectionConfigured()) {
		error(
			503,
			'Vercel Sandbox 尚未設定，暫時無法連結 ChatGPT。'
		);
	}

	const currentConnection =
		await getChatgptProfileConnection(
			locals.user.id
		);

	if (currentConnection) {
		redirect(
			303,
			'/profile'
		);
	}

	return {};
};
