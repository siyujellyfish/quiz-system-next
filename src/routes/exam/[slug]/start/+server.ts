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
	createExamQuestions,
	ExamError
} from '$lib/server/quiz/exam.service';


export const POST: RequestHandler =
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

		try {
			const questions =
				await createExamQuestions(
					bank.id
				);

			return json({
				questions
			});
		} catch (caught) {
			if (caught instanceof ExamError) {
				error(
					caught.status,
					caught.message
				);
			}

			throw caught;
		}
	};
