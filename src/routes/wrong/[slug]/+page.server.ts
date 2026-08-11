import {
	error,
	redirect
} from '@sveltejs/kit';


import type {
	PageServerLoad
} from './$types';


import {
	getQuestionBankBySlug
} from '$lib/server/quiz/bank.repository';


import {
	getWrongQuestionView
} from '$lib/server/quiz/wrong.service';


export const load: PageServerLoad =
	async ({
		locals,
		params
	}) => {
		if (!locals.user) {
			const redirectTo =
				encodeURIComponent(
					`/wrong/${params.slug}`
				);

			redirect(
				303,
				`/login?redirectTo=${redirectTo}`
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

		const wrong =
			await getWrongQuestionView(
				locals.user.id,
				bank.id
			);

		return {
			bank,
			wrong
		};
	};
