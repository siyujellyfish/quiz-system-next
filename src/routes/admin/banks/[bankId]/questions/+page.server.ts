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
	getAdminQuestionList,
	type AdminQuestionHealthFilter
} from '$lib/server/admin/question.repository';

const PAGE_SIZES = [25, 50, 100] as const;

function parsePositiveInteger(
	value: string | null,
	fallback: number
): number {
	const parsed = Number(value);

	return Number.isInteger(parsed) &&
		parsed > 0
		? parsed
		: fallback;
}

function parsePageSize(
	value: string | null
): number {
	const parsed = Number(value);

	return PAGE_SIZES.includes(
		parsed as (typeof PAGE_SIZES)[number]
	)
		? parsed
		: 25;
}

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

	const query =
		(url.searchParams.get('q') ?? '')
			.trim()
			.slice(0, 200);
	const health = parseHealthFilter(
		url.searchParams.get('health')
	);
	const requestedPage = parsePositiveInteger(
		url.searchParams.get('page'),
		1
	);
	const pageSize = parsePageSize(
		url.searchParams.get('size')
	);

	const questionList =
		await getAdminQuestionList({
			bankId: bank.id,
			query,
			health,
			page: requestedPage,
			pageSize
		});

	const rawImportedCount = Number(
		url.searchParams.get('importedCount') ?? 0
	);

	return {
		bank,
		updated:
			url.searchParams.get('updated') === '1',
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
				: 0,
		questions: questionList.questions,
		pagination: {
			total: questionList.total,
			page: questionList.page,
			totalPages: questionList.totalPages,
			pageSize: questionList.pageSize
		},
		filters: {
			query,
			health
		}
	};
};
