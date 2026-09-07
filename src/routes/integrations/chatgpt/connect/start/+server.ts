import {
	json
} from '@sveltejs/kit';

import type {
	RequestHandler
} from './$types';

import {
	getChatgptProfileConnection,
	isChatgptConnectionConfigured,
	startChatgptDeviceLogin
} from '$lib/server/profile/chatgpt.service';

export const POST: RequestHandler = async ({
	locals
}) => {
	if (!locals.user) {
		return json(
			{
				error: 'Unauthorized'
			},
			{
				status: 401
			}
		);
	}

	if (!isChatgptConnectionConfigured()) {
		return json(
			{
				error: 'Vercel Sandbox 尚未設定。'
			},
			{
				status: 503
			}
		);
	}

	const currentConnection =
		await getChatgptProfileConnection(
			locals.user.id
		);

	if (currentConnection) {
		return json(
			{
				error: 'ChatGPT 已連結。'
			},
			{
				status: 409
			}
		);
	}

	try {
		return json(
			await startChatgptDeviceLogin(
				locals.user.id
			)
		);
	} catch (caughtError) {
		console.error(
			'Unable to start ChatGPT device login in Vercel Sandbox',
			caughtError
		);

		return json(
			{
				error:
					caughtError instanceof Error
						? caughtError.message
						: '無法啟動 ChatGPT 授權流程。'
			},
			{
				status: 503
			}
		);
	}
};
