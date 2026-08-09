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

export const actions: Actions = {
	default: async ({ request }) => {
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
			const bank =
				await createValidatedAdminBank(
					validation
				);

			redirect(
				303,
				`/admin/banks/${bank.id}`
			);
		} catch (error) {
			if (
				error instanceof
				AdminBankConflictError
			) {
				return fail(409, {
					values: validation.values,
					errors: {
						slug: error.message
					},
					message: error.message
				});
			}

			throw error;
		}
	}
};
