import {
	fail,
	redirect
} from '@sveltejs/kit';

import type {
	Actions
} from './$types';

import {
	ADMIN_BANK_IMPORT_MAX_FILE_SIZE,
	getAdminBankImportMode,
	importAdminBankDocument,
	parseAdminBankImportJson
} from '$lib/server/admin/bank-transfer.service';

import {
	requireAdmin
} from '$lib/server/auth/admin';

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
		const file = formData.get('questionFile');

		if (!(file instanceof File) || file.size === 0) {
			return fail(400, {
				message: '請選擇完整題庫 JSON 檔案',
				preview: undefined,
				payload: undefined,
				mode: undefined
			});
		}

		if (file.size > ADMIN_BANK_IMPORT_MAX_FILE_SIZE) {
			return fail(413, {
				message: '題庫 JSON 不可超過 5 MB',
				preview: undefined,
				payload: undefined,
				mode: undefined
			});
		}

		const parsed = parseAdminBankImportJson(
			await file.text()
		);

		if (!parsed.ok) {
			return fail(400, {
				message: parsed.message,
				preview: undefined,
				payload: undefined,
				mode: undefined
			});
		}

		const mode = await getAdminBankImportMode(
			parsed.document.bank.slug
		);

		return {
			message: undefined,
			preview: parsed.preview,
			payload: parsed.payload,
			mode
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
		const payload = formData.get('payload');
		const parsed =
			typeof payload === 'string'
				? parseAdminBankImportJson(payload)
				: null;

		if (!parsed?.ok) {
			return fail(400, {
				message:
					parsed?.message ??
					'匯入資料已失效，請重新選擇 JSON 檔案',
				preview: undefined,
				payload: undefined,
				mode: undefined
			});
		}

		const result = await importAdminBankDocument(
			parsed.document
		);

		redirect(
			303,
			`/admin/banks/${result.bankId}/questions?imported=1&importMode=${result.mode}&matched=${result.matchedQuestionCount}&inserted=${result.insertedQuestionCount}&explanations=${result.updatedExplanationCount}`
		);
	}
};
