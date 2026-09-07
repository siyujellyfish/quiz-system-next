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
	cancelChatgptMessage,
	ChatgptNotConnectedError,
	ChatgptRelinkRequiredError
} from '$lib/server/profile/chatgpt.service';

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async ({
	locals,
	request
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

	let payload: unknown;

	try {
		payload = await request.json();
	} catch {
		return json(
			{
				error: 'Invalid JSON body'
			},
			{
				status: 400
			}
		);
	}

	const generationId =
		typeof payload === 'object' &&
		payload !== null &&
		!Array.isArray(payload) &&
		' generationId'.trim() in payload &&
		typeof (
			payload as Record<string, unknown>
		).generationId === 'string'
			? (
				payload as Record<string, string>
			).generationId.trim()
			: '';

	if (!UUID_PATTERN.test(generationId)) {
		return json(
			{
				error: 'generationId is invalid'
			},
			{
				status: 400
			}
		);
	}

	try {
		return json(
			await cancelChatgptMessage(
				locals.user.id,
				generationId
			)
		);
	} catch (caughtError) {
		if (
			caughtError instanceof
				ChatgptRelinkRequiredError ||
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
			'Unable to cancel AskAI generation',
			caughtError
		);

		return json(
			{
				error:
					caughtError instanceof
						CodexSandboxError
						? caughtError.message
						: '暫時無法取消 AI 回答。'
			},
			{
				status: 503
			}
		);
	}
};
