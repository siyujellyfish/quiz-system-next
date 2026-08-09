import {
	error
} from '@sveltejs/kit';


import type {
	PageServerLoad
} from './$types';


import {
	getQuestionBankBySlug
} from '$lib/server/quiz/bank.repository';


export const load: PageServerLoad =
	async ({ params }) => {
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

		return {
			bank
		};
	};
