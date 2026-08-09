import {
	error,
	json
} from '@sveltejs/kit';


import type {
	RequestHandler
} from './$types';


import {
	getQuestionBankBySlug
} from '$lib/server/quiz/bank.repository';


import {
	getPublicPracticeQuestion
} from '$lib/server/quiz/question.service';


type QuestionRequest = {
	questionId: unknown;
	optionIds: unknown;
};


export const POST: RequestHandler =
	async ({
		params,
		request
	}) => {
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

		const body =
			await request.json() as
				QuestionRequest;

		if (
			typeof body.questionId !==
			'string'
		) {
			error(
				400,
				'questionId 格式錯誤'
			);
		}

		if (
			!Array.isArray(
				body.optionIds
			) ||
			!body.optionIds.every(
				(optionId) =>
					typeof optionId ===
					'string'
			)
		) {
			error(
				400,
				'optionIds 格式錯誤'
			);
		}

		const question =
			await getPublicPracticeQuestion(
				bank.id,
				body.questionId,
				body.optionIds as string[]
			);

		if (!question) {
			error(
				404,
				'找不到指定的題目'
			);
		}

		return json({
			question
		});
	};