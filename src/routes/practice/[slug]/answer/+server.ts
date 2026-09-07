import {
	error,
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
	answerGuestPracticeQuestion,
	answerUserPracticeQuestion,
	PracticeAnswerError
} from '$lib/server/quiz/answer.service';


type AnswerRequest = {
	questionId: unknown;
	selectedOptionId: unknown;
};


export const POST: RequestHandler =
	async ({
		locals,
		params,
		request,
		cookies
	}) => {
		let body: AnswerRequest;

		try {
			body =
				await request.json() as
					AnswerRequest;
		} catch {
			error(
				400,
				'請求內容不是有效的 JSON'
			);
		}

		if (
			typeof body.questionId !==
				'string' ||
			body.questionId.length === 0
		) {
			error(
				400,
				'questionId 格式錯誤'
			);
		}

		if (
			typeof body.selectedOptionId !==
				'string' ||
			body.selectedOptionId.length === 0
		) {
			error(
				400,
				'selectedOptionId 格式錯誤'
			);
		}

		try {
			if (!locals.user) {
				return json(
					await answerGuestPracticeQuestion(
						params.slug,
						body.questionId,
						body.selectedOptionId
					)
				);
			}

			const result =
				await answerUserPracticeQuestion(
					locals.user.id,
					params.slug,
					body.questionId,
					body.selectedOptionId
				);
			const sessionTokenHash =
				getCurrentSessionTokenHash(cookies);

			if (!sessionTokenHash) {
				error(
					401,
					'登入工作階段已失效，請重新登入'
				);
			}

			return json({
				...result,
				aiContextToken:
					issueAiContextToken({
						sessionTokenHash,
						userId: locals.user.id,
						questionId:
							body.questionId,
						selectedOptionId:
							result.selectedOptionId,
						mode: 'practice'
					})
			});
		} catch (caughtError) {
			if (
				caughtError instanceof
					PracticeAnswerError
			) {
				error(
					caughtError.status,
					caughtError.message
				);
			}

			throw caughtError;
		}
	};
