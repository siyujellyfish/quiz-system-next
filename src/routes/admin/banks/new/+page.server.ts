import {
	fail,
	redirect
} from '@sveltejs/kit';

import type {
	Actions
} from './$types';

import {
	AdminBankConflictError,
	createValidatedAdminBank,
	validateAdminBankForm
} from '$lib/server/admin/bank.service';

import {
	requireAdmin
} from '$lib/server/auth/admin';

export const actions: Actions = {
	default: async ({
		request,
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

		let bank;

		try {
			bank =
				await createValidatedAdminBank(
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

			throw caughtError;
		}

		redirect(
			303,
			`/admin/banks/${bank.id}`
		);
	}
};
