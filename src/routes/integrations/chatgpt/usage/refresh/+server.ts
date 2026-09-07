import {
	json
} from '@sveltejs/kit';

import type {
	RequestHandler
} from './$types';

import {
	CodexSandboxError
} from '$lib/server/integrations/codex-sandbox';
import {
	ChatgptNotConnectedError,
	refreshChatgptCodexUsage
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
		const usage = await refreshChatgptCodexUsage(
			locals.user.id
		);

		return json({
			usage,
			updatedAt: new Date().toISOString()
		});
	} catch (caughtError) {
		if (
			caughtError instanceof
			ChatgptNotConnectedError
		) {
			return json(
				{
					error:
						'ChatGPT 連結已失效，請重新連結。'
				},
				{
					status: 409
				}
			);
		}

		console.error(
			'Unable to refresh Codex usage',
			caughtError
		);

		return json(
			{
				error:
					caughtError instanceof
						CodexSandboxError
						? caughtError.message
						: '暫時無法取得 Codex 用量，請稍後再試。'
			},
			{
				status:
					caughtError instanceof
						CodexSandboxError &&
						caughtError.status >= 400 &&
						caughtError.status < 600
						? caughtError.status
						: 503
			}
		);
	}
};
