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
	getPracticeContextBySlug
} from '$lib/server/quiz/practice-context.repository';

import {
	deletePracticeProgress,
	getPracticeQuestionStateAtIndex,
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
		/*
		 * Guest 的 state 在 sessionStorage，
		 * SSR 階段無法取得。
		 */
		if (!locals.user) {
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
				bank,
				practice: null
			};
		}

		const context =
			await getPracticeContextBySlug(
				locals.user.id,
				params.slug
			);

		if (!context) {
			error(
				404,
				'找不到指定的題庫'
			);
		}

		const bank = {
			id: context.bankId,
			slug: context.bankSlug,
			name: context.bankName,
			description:
				context.bankDescription
		};

		if (
			context.progressUserId === null ||
			context.currentIndex === null ||
			context.answeredCount === null ||
			context.correctCount === null ||
			context.totalQuestions === null ||
			context.coverage === null ||
			context.shuffleOptions === null
		) {
			redirect(
				303,
				'/'
			);
		}

		const totalQuestions =
			context.totalQuestions;

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
			context.currentIndex;

		while (
			currentIndex <
			totalQuestions
		) {
			const questionState =
				currentIndex ===
					context.currentIndex
					? context.questionState
					: await getPracticeQuestionStateAtIndex(
						locals.user.id,
						bank.id,
						currentIndex
					);

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
				context.currentIndex
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
						context.answeredCount,
					correctCount:
						context.correctCount,
					coverage:
						context.coverage,
					shuffleOptions:
						context.shuffleOptions,
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
