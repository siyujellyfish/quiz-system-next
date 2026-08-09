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
	deleteAdminQuestion,
	getAdminQuestionEditor
} from '$lib/server/admin/question.repository';

import {
	AdminQuestionNotFoundError,
	AdminQuestionOptionConflictError,
	parseAdminQuestionOptions,
	updateValidatedAdminQuestion,
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

	const question = await getAdminQuestionEditor(
		bank.id,
		params.questionId
	);

	if (!question) {
		error(404, '找不到指定的題目');
	}

	return {
		bank,
		question
	};
};

export const actions: Actions = {
	update: async ({
		request,
		params,
		locals,
		url
	}) => {
		requireAdmin(
			locals.user,
			url.pathname
		);

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

		try {
			const result =
				await updateValidatedAdminQuestion(
					params.bankId,
					params.questionId,
					validation
				);

			return {
				updated: true,
				practiceProgressReset:
					result.practiceProgressReset,
				values: validation.values,
				message: result.practiceProgressReset
					? '題目已更新；因選項數量改變，此題庫進行中的 Practice 已重置。'
					: '題目已更新。'
			};
		} catch (caughtError) {
			if (
				caughtError instanceof
				AdminQuestionNotFoundError
			) {
				error(404, caughtError.message);
			}

			if (
				caughtError instanceof
				AdminQuestionOptionConflictError
			) {
				return fail(409, {
					values: validation.values,
					message: caughtError.message
				});
			}

			throw caughtError;
		}
	},

	delete: async ({
		params,
		locals,
		url
	}) => {
		requireAdmin(
			locals.user,
			url.pathname
		);

		const deleted = await deleteAdminQuestion(
			params.bankId,
			params.questionId
		);

		if (!deleted) {
			error(404, '找不到指定的題目');
		}

		redirect(
			303,
			`/admin/banks/${params.bankId}/questions`
		);
	}
};
