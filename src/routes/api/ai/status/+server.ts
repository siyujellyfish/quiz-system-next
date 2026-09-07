import {
	json
} from '@sveltejs/kit';

import type {
	RequestHandler
} from './$types';

import {
	getChatgptProfileConnection
} from '$lib/server/profile/chatgpt.service';

export const GET: RequestHandler = async ({
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

	try {
		const connection =
			await getChatgptProfileConnection(
				locals.user.id
			);

		return json({
			connected: Boolean(connection),
			planType:
				connection?.planType ?? null,
			usage:
				connection?.usage ?? null,
			usageAvailable:
				connection?.usageAvailable ?? false,
			usageError:
				connection?.usageError ?? false,
			usageUpdatedAt:
				connection?.usageUpdatedAt
					?.toISOString() ?? null
		});
	} catch (caughtError) {
		console.error(
			'Unable to read AskAI connection status',
			caughtError
		);

		return json(
			{
				error:
					'暫時無法確認 ChatGPT 連結狀態。'
			},
			{
				status: 503
			}
		);
	}
};
