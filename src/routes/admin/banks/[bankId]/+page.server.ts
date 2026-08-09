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
	deleteAdminQuestionBank,
	getAdminQuestionBankWithStats
} from '$lib/server/admin/bank.repository';

import {
	AdminBankConflictError,
	AdminBankNotFoundError,
	updateValidatedAdminBank,
	validateAdminBankForm
} from '$lib/server/admin/bank.service';

import {
	requireAdmin
} from '$lib/server/auth/admin';

export const load: PageServerLoad = async ({
	params
}) => {
	const bank =
		await getAdminQuestionBankWithStats(
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

		const formData =
			await request.formData();

		const validation =
			validateAdminBankForm({
				name: String(
					formData.get('name') ?? ''
				),
				slug: String(
					formData.get('slug') ?? ''
				),
				description: String(
					formData.get('description') ?? ''
				)
			});

		if (!validation.ok) {
			return fail(400, {
				values: validation.values,
				errors: validation.errors,
				message: '請修正表單欄位'
			});
		}

		try {
			await updateValidatedAdminBank(
				params.bankId,
				validation
			);
		} catch (caughtError) {
			if (
				caughtError instanceof
				AdminBankConflictError
			) {
				return fail(409, {
					values: validation.values,
					errors: {
						slug: caughtError.message
					},
					message: caughtError.message
				});
			}

			if (
				caughtError instanceof
				AdminBankNotFoundError
			) {
				error(404, caughtError.message);
			}

			throw caughtError;
		}

		return {
			updated: true,
			values: validation.values,
			message: '題庫資料已更新'
		};
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

		const deleted =
			await deleteAdminQuestionBank(
				params.bankId
			);

		if (!deleted) {
			error(404, '找不到指定的題庫');
		}

		redirect(303, '/admin/banks');
	}
};
