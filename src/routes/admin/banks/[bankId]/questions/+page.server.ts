import {
	error
} from '@sveltejs/kit';

import type {
	PageServerLoad
} from './$types';

import {
	getAdminQuestionBankById
} from '$lib/server/admin/bank.repository';

import {
	getAdminQuestions
} from '$lib/server/admin/question.repository';

export const load: PageServerLoad = async ({
	params
}) => {
	const bank = await getAdminQuestionBankById(
		params.bankId
	);

	if (!bank) {
		error(404, '找不到指定的題庫');
	}

	const questions = await getAdminQuestions(
		bank.id
	);

	return {
		bank,
		questions: questions.map(
			(question) => ({
				...question,
				optionCount:
					Number(question.optionCount),
				correctOptionCount:
					Number(question.correctOptionCount)
			})
	};
};
