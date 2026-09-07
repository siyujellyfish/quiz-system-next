import {
	json
} from '@sveltejs/kit';

import type {
	RequestHandler
} from './$types';

import {
	AskAiError,
	sendAskAiMessage
} from '$lib/server/ai/ask-ai.service';
import {
	getCurrentSessionTokenHash
} from '$lib/server/auth/session';

const MAX_MESSAGE_LENGTH = 8000;
const MAX_AI_CONTEXT_TOKEN_LENGTH = 4096;
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async ({
	locals,
	request,
	cookies
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
	const questionId =
		typeof body.questionId === 'string'
			? body.questionId.trim()
			: '';
	const conversationId =
		typeof body.conversationId === 'string'
			? body.conversationId.trim()
			: null;
	const aiContextToken =
		typeof body.aiContextToken === 'string'
			? body.aiContextToken.trim()
			: null;
	const generationId =
		typeof body.generationId === 'string'
			? body.generationId.trim()
			: '';

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

	if (!UUID_PATTERN.test(questionId)) {
		return json(
			{
				error: 'questionId is invalid'
			},
			{
				status: 400
			}
		);
	}

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

	if (
		conversationId &&
		!UUID_PATTERN.test(conversationId)
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

	if (
		aiContextToken &&
		aiContextToken.length >
			MAX_AI_CONTEXT_TOKEN_LENGTH
	) {
		return json(
			{
				error: 'aiContextToken is invalid'
			},
			{
				status: 400
			}
		);
	}

	const sessionTokenHash =
		getCurrentSessionTokenHash(cookies);

	if (!sessionTokenHash) {
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
		return json(
			await sendAskAiMessage({
				userId: locals.user.id,
				sessionTokenHash,
				questionId,
				conversationId,
				aiContextToken:
					conversationId
						? null
						: aiContextToken,
				generationId,
				message
			})
		);
	} catch (caughtError) {
		if (caughtError instanceof AskAiError) {
			return json(
				{
					error: caughtError.message,
					code: caughtError.code,
					retryable:
						caughtError.retryable,
					resetAt:
						caughtError.resetAt
				},
				{
					status: caughtError.status
				}
			);
		}

		console.error(
			'Unable to complete AskAI request',
			caughtError
		);

		return json(
			{
				error:
					'AI 題目助教暫時無法使用，請稍後重試。',
				code: 'AI_TEMPORARY_UNAVAILABLE',
				retryable: true,
				resetAt: null
			},
			{
				status: 503
			}
		);
	}
};
