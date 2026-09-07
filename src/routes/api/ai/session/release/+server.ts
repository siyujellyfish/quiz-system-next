import {
	json
} from '@sveltejs/kit';

import type {
	RequestHandler
} from './$types';

import {
	releaseChatgptMessageSession
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

	try {
		await releaseChatgptMessageSession(
			locals.user.id
		);

		return json({
			released: true
		});
	} catch (caughtError) {
		console.error(
			'Unable to release AskAI Sandbox session',
			caughtError
		);

		return json(
			{
				error: '暫時無法釋放 AI 工作階段。'
			},
			{
				status: 503
			}
		);
	}
};
