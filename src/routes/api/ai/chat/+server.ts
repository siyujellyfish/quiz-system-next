import {
	json
} from '@sveltejs/kit';

import type {
	RequestHandler
} from './$types';

import {
	CodexGatewayError
} from '$lib/server/integrations/codex-gateway';
import {
	ChatgptNotConnectedError,
	sendChatgptMessage
} from '$lib/server/profile/chatgpt.service';

const MAX_MESSAGE_LENGTH = 8000;
const MAX_CONTEXT_LENGTH = 24000;
const MAX_CONVERSATION_ID_LENGTH = 255;

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

	if (
		typeof payload !== 'object' ||
		payload === null ||
		Array.isArray(payload)
	) {
		return json(
			{
				error: 'Invalid request body'
			},
			{
				status: 400
			}
		);
	}

	const body = payload as Record<string, unknown>;
	const message =
		typeof body.message === 'string'
			? body.message.trim()
			: '';
	const context =
		typeof body.context === 'string'
			? body.context.trim()
			: null;
	const conversationId =
		typeof body.conversationId === 'string'
			? body.conversationId.trim()
			: null;

	if (
		!message ||
		message.length > MAX_MESSAGE_LENGTH
	) {
		return json(
			{
				error:
					`message must contain 1 to ${MAX_MESSAGE_LENGTH} characters`
			},
			{
				status: 400
			}
		);
	}

	if (
		context &&
		context.length > MAX_CONTEXT_LENGTH
	) {
		return json(
			{
				error:
					`context must not exceed ${MAX_CONTEXT_LENGTH} characters`
			},
			{
				status: 400
			}
		);
	}

	if (
		conversationId &&
		conversationId.length >
			MAX_CONVERSATION_ID_LENGTH
	) {
		return json(
			{
				error: 'conversationId is invalid'
			},
			{
				status: 400
			}
		);
	}

	try {
		const response = await sendChatgptMessage(
			locals.user.id,
			{
				threadId: conversationId,
				message,
				context
			}
		);

		return json({
			conversationId: response.threadId,
			message: response.message
		});
	} catch (caughtError) {
		if (
			caughtError instanceof
			ChatgptNotConnectedError
		) {
			return json(
				{
					error:
						'請先在個人資料連結 ChatGPT。'
				},
				{
					status: 409
				}
			);
		}

		if (
			caughtError instanceof
			CodexGatewayError
		) {
			return json(
				{
					error: caughtError.message
				},
				{
					status:
						caughtError.status >= 400 &&
						caughtError.status < 600
							? caughtError.status
							: 503
				}
			);
		}

		console.error(
			'Unable to complete Codex chat request',
			caughtError
		);

		return json(
			{
				error: 'AI 對話暫時無法使用。'
			},
			{
				status: 503
			}
		);
	}
};
