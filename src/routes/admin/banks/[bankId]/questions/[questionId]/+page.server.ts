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
	deleteAdminQuestion
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
	redirect(
		303,
		`/admin/banks/${params.bankId}/questions?question=${encodeURIComponent(params.questionId)}`
	);
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

		let practiceProgressReset = false;

		try {
			const result =
				await updateValidatedAdminQuestion(
					params.bankId,
					params.questionId,
					validation
				);

			practiceProgressReset =
				result.practiceProgressReset;
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
					errors: undefined,
					message: caughtError.message
				});
			}

			throw caughtError;
		}

		const searchParams = new URLSearchParams({
			question: params.questionId,
			updated: '1'
		});

		if (practiceProgressReset) {
			searchParams.set(
				'practiceProgressReset',
				'1'
			);
		}

		redirect(
			303,
			`/admin/banks/${params.bankId}/questions?${searchParams.toString()}`
		);
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
