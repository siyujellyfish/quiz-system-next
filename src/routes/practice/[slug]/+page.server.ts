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
	deletePracticeProgress,
	getPracticeProgress,
	setPracticeCurrentIndex
} from '$lib/server/quiz/practice.repository';

import {
	getPublicPracticeQuestion
} from '$lib/server/quiz/question.service';


export const load: PageServerLoad =
	async ({
		locals,
		params
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

		/*
		 * Guest 的 state 在 sessionStorage，
		 * SSR 階段無法取得。
		 */
		if (!locals.user) {
			return {
				bank,
				practice: null
			};
		}

		const progress =
			await getPracticeProgress(
				locals.user.id,
				bank.id
			);

		if (!progress) {
			redirect(
				303,
				'/'
			);
		}

		const {
			questionsState
		} = progress;

		const totalQuestions =
			questionsState
				.questions
				.length;

		if (totalQuestions === 0) {
			await deletePracticeProgress(
				locals.user.id,
				bank.id
			);

			redirect(
				303,
				'/'
			);
		}

		let currentIndex =
			progress.currentIndex;

		while (
			currentIndex <
			totalQuestions
		) {
			const questionState =
				questionsState
					.questions[
						currentIndex
					];

			if (!questionState) {
				currentIndex++;
				continue;
			}

			const question =
				await getPublicPracticeQuestion(
					bank.id,
					questionState.questionId,
					questionState.optionIds
				);

			if (!question) {
				currentIndex++;
				continue;
			}

			if (
				currentIndex !==
				progress.currentIndex
			) {
				await setPracticeCurrentIndex(
					locals.user.id,
					bank.id,
					currentIndex
				);
			}

			return {
				bank,

				practice: {
					currentIndex,
					totalQuestions,
					answeredCount:
						progress.answeredCount,
					correctCount:
						progress.correctCount,
					coverage:
						questionsState.coverage,
					shuffleOptions:
						questionsState.shuffleOptions,
					question
				}
			};
		}

		/*
		 * 剩餘題目都已失效，視為本次練習完成。
		 */
		await deletePracticeProgress(
			locals.user.id,
			bank.id
		);

		redirect(
			303,
			'/'
		);
	};
