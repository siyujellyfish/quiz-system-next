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
	deleteAdminQuestion
} from '$lib/server/admin/question.repository';

import {
	getAdminQuestionWorkspace,
	type AdminQuestionHealthFilter
} from '$lib/server/admin/question-workspace.repository';

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

function parseHealthFilter(
	value: string | null
): AdminQuestionHealthFilter {
	switch (value) {
		case 'healthy':
		case 'invalid':
			return value;

		default:
			return 'all';
	}
}

function parseQuery(value: string | null): string {
	return (value ?? '')
		.trim()
		.slice(0, 200);
}

function getWorkspaceHref(
	bankId: string,
	input: {
		query?: string;
		health?: AdminQuestionHealthFilter;
		questionId?: string | null;
		updated?: boolean;
		created?: boolean;
		practiceProgressReset?: boolean;
	}
): string {
	const params = new URLSearchParams();

	if (input.query) {
		params.set('q', input.query);
	}

	if (
		input.health &&
		input.health !== 'all'
	) {
		params.set('health', input.health);
	}

	if (input.questionId) {
		params.set(
			'question',
			input.questionId
		);
	}

	if (input.updated) {
		params.set('updated', '1');
	}

	if (input.created) {
		params.set('created', '1');
	}

	if (input.practiceProgressReset) {
		params.set(
			'practiceProgressReset',
			'1'
		);
	}

	const query = params.toString();

	return `/admin/banks/${bankId}/questions${
		query ? `?${query}` : ''
	}`;
}

export const load: PageServerLoad = async ({
	params,
	url
}) => {
	const bank = await getAdminQuestionBankById(
		params.bankId
	);

	if (!bank) {
		error(404, '找不到指定的題庫');
	}

	const query = parseQuery(
		url.searchParams.get('q')
	);
	const health = parseHealthFilter(
		url.searchParams.get('health')
	);
	const requestedQuestionId =
		url.searchParams.get('question');

	const workspace =
		await getAdminQuestionWorkspace({
			bankId: bank.id,
			query,
			health,
			questionId: requestedQuestionId
		});

	const rawImportedCount = Number(
		url.searchParams.get('importedCount') ?? 0
	);

	return {
		bank,
		workspace,
		filters: {
			query,
			health
		},
		updated:
			url.searchParams.get('updated') === '1',
		created:
			url.searchParams.get('created') === '1',
		practiceProgressReset:
			url.searchParams.get(
				'practiceProgressReset'
			) === '1',
		imported:
			url.searchParams.get('imported') === '1',
		importedCount:
			Number.isInteger(rawImportedCount) &&
			rawImportedCount >= 0
				? rawImportedCount
				: 0
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
		const questionId = String(
			formData.get('questionId') ?? ''
		);
		const query = parseQuery(
			String(formData.get('query') ?? '')
		);
		const health = parseHealthFilter(
			String(formData.get('health') ?? 'all')
		);
		const prompt = String(
			formData.get('prompt') ?? ''
		);
		const options = parseAdminQuestionOptions(
			formData.get('options')
		);

		if (!questionId) {
			error(404, '找不到指定的題目');
		}

		if (!options) {
			return fail(400, {
				questionId,
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
				questionId,
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
					questionId,
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
					questionId,
					values: validation.values,
					errors: undefined,
					message: caughtError.message
				});
			}

			throw caughtError;
		}

		redirect(
			303,
			getWorkspaceHref(
				params.bankId,
				{
					query,
					health,
					questionId,
					updated: true,
					practiceProgressReset
				}
			)
		);
	},

	delete: async ({
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
		const questionId = String(
			formData.get('questionId') ?? ''
		);
		const nextQuestionId = String(
			formData.get('nextQuestionId') ?? ''
		) || null;
		const query = parseQuery(
			String(formData.get('query') ?? '')
		);
		const health = parseHealthFilter(
			String(formData.get('health') ?? 'all')
		);

		if (!questionId) {
			error(404, '找不到指定的題目');
		}

		const deleted = await deleteAdminQuestion(
			params.bankId,
			questionId
		);

		if (!deleted) {
			error(404, '找不到指定的題目');
		}

		redirect(
			303,
			getWorkspaceHref(
				params.bankId,
				{
					query,
					health,
					questionId:
						nextQuestionId
				}
			)
		);
	}
};
