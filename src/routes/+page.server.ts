import {
	fail,
	redirect
} from '@sveltejs/kit';


import type {
	Actions,
	PageServerLoad
} from './$types';


import type {
	PracticeCoverage
} from '$lib/types/quiz';


import {
	getQuestionBankById,
	getQuestionBanksWithCount
} from '$lib/server/quiz/bank.repository';


import {
	getPracticeProgressSummariesByUser
} from '$lib/server/quiz/practice.repository';


import {
	generatePracticeState,
	PracticeStateError,
	startPractice
} from '$lib/server/quiz/practice.service';


import {
	getWrongQuestionCountsByUser
} from '$lib/server/quiz/wrong.repository';


function parseCoverage(
	value: FormDataEntryValue | null
): PracticeCoverage | null {
	const coverage =
		Number(value);

	switch (coverage) {
		case 30:
		case 50:
		case 100:
			return coverage;

		default:
			return null;
	}
}


export const load: PageServerLoad =
	async ({ locals }) => {
		const banks =
			await getQuestionBanksWithCount();

		if (!locals.user) {
			return {
				banks: banks.map(
					(bank) => ({
						...bank,
						progress: null,
						wrongCount: null
					})
			)};
		}

		const [
			progresses,
			wrongCounts
		] = await Promise.all([
			getPracticeProgressSummariesByUser(
				locals.user.id
			),
			getWrongQuestionCountsByUser(
				locals.user.id
			)
		]);

		const progressMap =
			new Map(
				progresses.map(
					(progress) => [
						progress.bankId,
						progress
					]
				)
			);

		const wrongCountMap =
			new Map(
				wrongCounts.map(
					(item) => [
						item.bankId,
						Number(item.wrongCount)
					]
				)
			);

		return {
			banks: banks.map(
				(bank) => {
					const progress =
						progressMap.get(
							bank.id
						);

					const wrongCount =
						wrongCountMap.get(
							bank.id
						) ?? 0;

					if (!progress) {
						return {
							...bank,
							progress: null,
							wrongCount
						};
					}

					const completedQuestions =
						Math.min(
							progress.currentIndex,
							progress.totalQuestions
						);

					return {
						...bank,
						wrongCount,

						progress: {
							completedQuestions,
							totalQuestions:
								progress.totalQuestions,
							coverage:
								progress.coverage,
							shuffleOptions:
								progress.shuffleOptions
						}
					};
			}
		)
		};
	};


export const actions: Actions = {
	startPractice: async ({
		request,
		locals
	}) => {
		const data =
			await request.formData();

		const bankId =
			String(
				data.get('bankId') ?? ''
			);

		const coverage =
			parseCoverage(
				data.get('coverage')
			);

		const optionOrder =
			String(
				data.get(
					'optionOrder'
				) ?? ''
			);

		if (!bankId) {
			return fail(400, {
				bankId,
				message:
					'請選擇題庫'
			});
		}

		if (!coverage) {
			return fail(400, {
				bankId,
				message:
					'題目數量設定無效'
			});
		}

		if (
			optionOrder !== 'fixed' &&
			optionOrder !== 'random'
		) {
			return fail(400, {
				bankId,
				message:
					'選項順序設定無效'
			});
		}

		const bank =
			await getQuestionBankById(
				bankId
			);

		if (!bank) {
			return fail(404, {
				bankId,
				message:
					'找不到指定的題庫'
			});
		}

		const config = {
			coverage,
			shuffleOptions:
				optionOrder === 'random'
		};

		if (locals.user) {
			try {
				await startPractice(
					locals.user.id,
					bank.id,
					config
				);
			} catch (error) {
				if (
					error instanceof
					PracticeStateError
				) {
					return fail(400, {
						bankId,
						message:
							error.message
					});
				}

				throw error;
			}

			redirect(
				303,
				`/practice/${bank.slug}`
			);
		}

		try {
			const questionsState =
				await generatePracticeState(
					bank.id,
					config
				);

			return {
				guestPractice: {
					slug:
						bank.slug,

					questionsState
				}
			};
		} catch (error) {
			if (
				error instanceof
				PracticeStateError
			) {
				return fail(400, {
					bankId,
					message:
						error.message
				});
			}

			throw error;
		}
	}
};
