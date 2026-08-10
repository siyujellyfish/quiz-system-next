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
	ExamAttemptError,
	startUserExamAttempt
} from '$lib/server/quiz/exam-attempt.service';

import {
	createExamQuestions,
	ExamError
} from '$lib/server/quiz/exam.service';


export const POST: RequestHandler =
	async ({ params, locals }) => {
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

			if (locals.user) {
				const attempt =
					await startUserExamAttempt({
						userId: locals.user.id,
						bankId: bank.id,
						bankName: bank.name,
						totalQuestions:
							questions.length
					});

				return json({
					questions,
					attemptId: attempt.id,
					startedAt:
						attempt.startedAt.getTime()
				});
			}

			return json({
				questions,
				attemptId: null,
				startedAt: Date.now()
			});
		} catch (caught) {
			if (caught instanceof ExamError) {
				error(
					caught.status,
					caught.message
				);
			}

			if (caught instanceof ExamAttemptError) {
				error(
					caught.status,
					caught.message
				);
			}

			throw caught;
		}
	};
