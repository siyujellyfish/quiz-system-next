import {
	error,
	json
} from '@sveltejs/kit';


import type {
	RequestHandler
} from './$types';


import {
	getPublicPracticeQuestionByBankSlug
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
		let body: QuestionRequest;

		try {
			body =
				await request.json() as
					QuestionRequest;
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
			!Array.isArray(
				body.optionIds
			) ||
			body.optionIds.length === 0 ||
			!body.optionIds.every(
				(optionId) =>
					typeof optionId ===
						'string' &&
					optionId.length > 0
			)
		) {
			error(
				400,
				'optionIds 格式錯誤'
			);
		}

		const optionIds = [
			...new Set(body.optionIds)
		];

		const question =
			await getPublicPracticeQuestionByBankSlug(
				params.slug,
				body.questionId,
				optionIds
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
