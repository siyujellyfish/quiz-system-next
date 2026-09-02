import {
	error,
	redirect
} from '@sveltejs/kit';

import type {
	PageServerLoad
} from './$types';

import {
	getChatgptProfileConnection,
	isChatgptConnectionConfigured,
	startChatgptDeviceLogin
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
			'Codex Gateway 尚未設定，暫時無法連結 ChatGPT。'
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

	try {
		return {
			login: await startChatgptDeviceLogin(
				locals.user.id
			)
		};
	} catch (caughtError) {
		console.error(
			'Unable to start ChatGPT device login',
			caughtError
		);

		error(
			503,
			'無法啟動 ChatGPT 授權流程，請稍後再試。'
		);
	}
};
