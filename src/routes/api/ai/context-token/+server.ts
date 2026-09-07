import {
	eq
} from 'drizzle-orm';
import {
	json
} from '@sveltejs/kit';

import type {
	RequestHandler
} from './$types';

import {
	issueAiContextToken
} from '$lib/server/ai/context-token';
import {
	getCurrentSessionTokenHash
} from '$lib/server/auth/session';
import {
	db
} from '$lib/server/db';
import {
	questions
} from '$lib/server/db/schema';
import {
	getLatestExamAttemptForUserBank
} from '$lib/server/quiz/exam-attempt.repository';

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

	let body: Record<string, unknown>;

	try {
		const payload = await request.json();

		if (
			typeof payload !== 'object' ||
			payload === null ||
			Array.isArray(payload)
		) {
			throw new Error('invalid');
		}

		body = payload as Record<string, unknown>;
	} catch {
		return json(
			{
				error: 'Invalid request body'
			},
			{
				status: 400
			}
		);
	}

	const questionId =
		typeof body.questionId === 'string'
			? body.questionId.trim()
			: '';

	if (!UUID_PATTERN.test(questionId)) {
		return json(
			{
				error: 'Invalid questionId'
			},
			{
				status: 400
			}
		);
	}

	const [question] = await db
		.select({
			bankId: questions.bankId
		})
		.from(questions)
		.where(
			eq(
				questions.id,
				questionId
			)
		)
		.limit(1);

	if (!question) {
		return json(
			{
				error: '找不到指定的題目。'
			},
			{
				status: 404
			}
		);
	}

	const attempt =
		await getLatestExamAttemptForUserBank(
			locals.user.id,
			question.bankId
		);
	const answers = attempt?.answers;

	if (
		!attempt?.submittedAt ||
		!answers ||
		!Object.prototype.hasOwnProperty.call(
			answers,
			questionId
		)
	) {
		return json(
			{
				error:
					'只有完成交卷後的題目才能使用 AskAI。'
			},
			{
				status: 403
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

	return json({
		aiContextToken: issueAiContextToken({
			sessionTokenHash,
			userId: locals.user.id,
			questionId,
			selectedOptionId:
				answers[questionId] ?? null,
			mode: 'exam',
			examAttemptId: attempt.id
		})
	});
};
