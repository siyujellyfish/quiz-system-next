import {
	fail,
	redirect
} from '@sveltejs/kit';

import type {
	Actions
} from './$types';

import {
	validateAdminBankForm
} from '$lib/server/admin/bank.service';

import {
	ADMIN_BANK_IMPORT_MAX_FILE_SIZE,
	AdminBankImportConflictError,
	ensureAdminBankImportSlugAvailable,
	importValidatedAdminQuestionBank,
	parseAdminBankImportJson
} from '$lib/server/admin/bank-transfer.service';

import {
	requireAdmin
} from '$lib/server/auth/admin';

function getBankValues(formData: FormData) {
	return {
		name: String(formData.get('name') ?? ''),
		slug: String(formData.get('slug') ?? ''),
		description: String(
			formData.get('description') ?? ''
		)
	};
}

export const actions: Actions = {
	preview: async ({
		request,
		locals,
		url
	}) => {
		requireAdmin(
			locals.user,
			url.pathname
		);

		const formData = await request.formData();
		const validation = validateAdminBankForm(
			getBankValues(formData)
		);

		if (!validation.ok) {
			return fail(400, {
				values: validation.values,
				errors: validation.errors,
				message: '請修正題庫設定',
				preview: undefined,
				payload: undefined
			});
		}

		const file = formData.get('questionFile');

		if (!(file instanceof File) || file.size === 0) {
			return fail(400, {
				values: validation.values,
				errors: undefined,
				message: '請選擇題庫 JSON 檔案',
				preview: undefined,
				payload: undefined
			});
		}

		if (file.size > ADMIN_BANK_IMPORT_MAX_FILE_SIZE) {
			return fail(413, {
				values: validation.values,
				errors: undefined,
				message: '題庫 JSON 不可超過 5 MB',
				preview: undefined,
				payload: undefined
			});
		}

		const parsed = parseAdminBankImportJson(
			await file.text()
		);

		if (!parsed.ok) {
			return fail(400, {
				values: validation.values,
				errors: undefined,
				message: parsed.message,
				preview: undefined,
				payload: undefined
			});
		}

		try {
			await ensureAdminBankImportSlugAvailable(
				validation.input.slug
			);
		} catch (error) {
			if (
				error instanceof
				AdminBankImportConflictError
			) {
				return fail(409, {
					values: validation.values,
					errors: {
						slug: error.message
					},
					message: '請修正題庫設定',
					preview: undefined,
					payload: undefined
				});
			}

			throw error;
		}

		return {
			values: validation.values,
			errors: undefined,
			message: undefined,
			preview: parsed.preview,
			payload: parsed.payload
		};
	},

	commit: async ({
		request,
		locals,
		url
	}) => {
		requireAdmin(
			locals.user,
			url.pathname
		);

		const formData = await request.formData();
		const validation = validateAdminBankForm(
			getBankValues(formData)
		);
		const payload = formData.get('payload');
		const parsed =
			typeof payload === 'string'
				? parseAdminBankImportJson(payload)
				: null;

		if (!validation.ok) {
			return fail(400, {
				values: validation.values,
				errors: validation.errors,
				message: '請修正題庫設定',
				preview:
					parsed?.ok
						? parsed.preview
						: undefined,
				payload:
					parsed?.ok
						? parsed.payload
						: undefined
			});
		}

		if (!parsed?.ok) {
			return fail(400, {
				values: validation.values,
				errors: undefined,
				message:
					parsed?.message ??
					'匯入資料已失效，請重新選擇 JSON 檔案',
				preview: undefined,
				payload: undefined
			});
		}

		try {
			const result =
				await importValidatedAdminQuestionBank(
					validation,
					parsed.questions
				);

			redirect(
				303,
				`/admin/banks/${result.bankId}/questions?imported=1&importedCount=${result.questionCount}`
			);
		} catch (error) {
			if (
				error instanceof
				AdminBankImportConflictError
			) {
				return fail(409, {
					values: validation.values,
					errors: {
						slug: error.message
					},
					message: '請修正題庫設定',
					preview: parsed.preview,
					payload: parsed.payload
				});
			}

			throw error;
		}
	}
};
