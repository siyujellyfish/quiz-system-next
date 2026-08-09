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
	getPracticeProgress
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
			questionsState,
			currentIndex
		} = progress;


		const totalQuestions =
			questionsState
				.questions
				.length;


		if (
			totalQuestions === 0 ||
			currentIndex >=
				totalQuestions
		) {
			redirect(
				303,
				'/'
			);
		}


		const questionState =
			questionsState
				.questions[
					currentIndex
				];


		if (!questionState) {
			error(
				409,
				'目前練習進度中的題目狀態不存在'
			);
		}


		const question =
			await getPublicPracticeQuestion(
				bank.id,
				questionState.questionId,
				questionState.optionIds
			);


		if (!question) {
			error(
				409,
				'目前題目已不存在或資料不完整'
			);
		}


		return {
			bank,

			practice: {
				currentIndex,
				totalQuestions,
				question
			}
		};
	};