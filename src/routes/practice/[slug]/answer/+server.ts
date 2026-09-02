import {
	error,
	json
} from '@sveltejs/kit';


import type {
	RequestHandler
} from './$types';


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
		request
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
			const result = locals.user
				? await answerUserPracticeQuestion(
					locals.user.id,
					params.slug,
					body.questionId,
					body.selectedOptionId
				)
				: await answerGuestPracticeQuestion(
					params.slug,
					body.questionId,
					body.selectedOptionId
				);

			return json(result);
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
