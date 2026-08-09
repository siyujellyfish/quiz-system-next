import {
	error
} from '@sveltejs/kit';

import type {
	RequestHandler
} from './$types';

import {
	getAdminQuestionBankExport
} from '$lib/server/admin/bank-transfer.repository';

import {
	requireAdmin
} from '$lib/server/auth/admin';

export const GET: RequestHandler = async ({
	params,
	locals,
	url
}) => {
	requireAdmin(
		locals.user,
		url.pathname
	);

	const exported =
		await getAdminQuestionBankExport(
			params.bankId
		);

	if (!exported) {
		error(404, '找不到指定的題庫');
	}

	const filename = `${exported.bank.slug}-questions.json`;
	const content = `${JSON.stringify(
		exported.questions,
		null,
		2
	)}\n`;

	return new Response(content, {
		headers: {
			'Content-Type':
				'application/json; charset=utf-8',
			'Content-Disposition':
				`attachment; filename="${filename}"`,
			'Cache-Control': 'private, no-store'
		}
	});
};
