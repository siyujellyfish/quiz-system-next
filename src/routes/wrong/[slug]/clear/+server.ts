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
	clearWrongQuestions
} from '$lib/server/quiz/wrong.service';


export const POST: RequestHandler =
	async ({
		locals,
		params
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

		const clearedCount =
			await clearWrongQuestions(
				locals.user.id,
				bank.id
			);

		return json({
			clearedCount
		});
	};
