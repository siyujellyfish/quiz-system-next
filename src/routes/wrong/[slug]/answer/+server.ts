import {
	error,
	json
} from '@sveltejs/kit';


import type {
	RequestHandler
} from './$types';


import {
	PracticeAnswerError
} from '$lib/server/quiz/answer.service';


import {
	getQuestionBankBySlug
} from '$lib/server/quiz/bank.repository';


import {
	answerWrongQuestion
} from '$lib/server/quiz/wrong.service';


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
		if (!locals.user) {
			error(
				401,
				'請先登入'
			);
		}

		const bank =
			await getQuestionBankBySlug(
				params.slug
			);

		if (!bank) {
			error(
				404,
				'找不到指定的題庫'
			);
		}

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
			const result =
				await answerWrongQuestion(
					locals.user.id,
					bank.id,
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
