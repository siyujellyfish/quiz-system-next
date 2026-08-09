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
	getWrongQuestionView
} from '$lib/server/quiz/wrong.service';


type NextQuestionRequest = {
	excludeQuestionId?: unknown;
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

		let body: NextQuestionRequest = {};

		try {
			body =
				await request.json() as
					NextQuestionRequest;
		} catch {
			/* 空 body 也允許 */
		}

		const excludeQuestionId =
			typeof body.excludeQuestionId ===
				'string' &&
			body.excludeQuestionId.length > 0
				? body.excludeQuestionId
				: null;

		const wrong =
			await getWrongQuestionView(
				locals.user.id,
				bank.id,
				excludeQuestionId
			);

		return json(wrong);
	};
