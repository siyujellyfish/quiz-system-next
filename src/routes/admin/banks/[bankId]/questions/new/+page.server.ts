import {
	error,
	fail,
	redirect
} from '@sveltejs/kit';

import type {
	Actions,
	PageServerLoad
} from './$types';

import {
	getAdminQuestionBankById
} from '$lib/server/admin/bank.repository';

import {
	AdminQuestionOptionConflictError,
	createValidatedAdminQuestion,
	parseAdminQuestionOptions,
	validateAdminQuestionForm
} from '$lib/server/admin/question.service';

import {
	requireAdmin
} from '$lib/server/auth/admin';

export const load: PageServerLoad = async ({
	params
}) => {
	const bank = await getAdminQuestionBankById(
		params.bankId
	);

	if (!bank) {
		error(404, '找不到指定的題庫');
	}

	return {
		bank
	};
};

export const actions: Actions = {
	default: async ({
		request,
		params,
		locals,
		url
	}) => {
		requireAdmin(
			locals.user,
			url.pathname
		);

		const bank = await getAdminQuestionBankById(
			params.bankId
		);

		if (!bank) {
			error(404, '找不到指定的題庫');
		}

		const formData = await request.formData();
		const prompt = String(
			formData.get('prompt') ?? ''
		);
		const options = parseAdminQuestionOptions(
			formData.get('options')
		);

		if (!options) {
			return fail(400, {
				values: {
					prompt,
					options: []
				},
				errors: undefined,
				message: '選項資料格式錯誤，請重新整理後再試'
			});
		}

		const validation = validateAdminQuestionForm({
			prompt,
			options
		});

		if (!validation.ok) {
			return fail(400, {
				values: validation.values,
				errors: validation.errors,
				message: '請修正題目設定'
			});
		}

		let createdQuestion;

		try {
			createdQuestion =
				await createValidatedAdminQuestion(
					bank.id,
					validation
				);
		} catch (caughtError) {
			if (
				caughtError instanceof
				AdminQuestionOptionConflictError
			) {
				return fail(409, {
					values: validation.values,
					errors: undefined,
					message: caughtError.message
				});
			}

			throw caughtError;
		}

		redirect(
			303,
			`/admin/banks/${bank.id}/questions?question=${encodeURIComponent(createdQuestion.id)}&created=1`
		);
	}
};
