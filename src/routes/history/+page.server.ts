import {
	fail,
	redirect
} from '@sveltejs/kit';

import type {
	Actions,
	PageServerLoad
} from './$types';

import {
	clearExamHistoryForUser,
	deleteExamHistoryForUser,
	getExamHistoryForUser
} from '$lib/server/quiz/exam-attempt.repository';

function requireUser(
	user: App.Locals['user'],
	pathname: string
) {
	if (!user) {
		redirect(
			303,
			`/login?redirectTo=${encodeURIComponent(pathname)}`
		);
	}

	return user;
}

function isUuid(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
		.test(value);
}

export const load: PageServerLoad = async ({
	locals,
	url
}) => {
	const user = requireUser(
		locals.user,
		url.pathname
	);

	return {
		attempts: await getExamHistoryForUser(
			user.id
		),
		deleted:
			url.searchParams.get('deleted') === '1',
		cleared:
			url.searchParams.get('cleared') === '1'
	};
};

export const actions: Actions = {
	delete: async ({
		request,
		locals,
		url
	}) => {
		const user = requireUser(
			locals.user,
			url.pathname
		);
		const data = await request.formData();
		const attemptId = String(
			data.get('attemptId') ?? ''
		);

		if (!isUuid(attemptId)) {
			return fail(400, {
				message: '歷史紀錄識別碼格式錯誤'
			});
		}

		const deleted =
			await deleteExamHistoryForUser(
				attemptId,
				user.id
			);

		if (!deleted) {
			return fail(404, {
				message: '找不到指定的測驗紀錄'
			});
		}

		redirect(
			303,
			'/history?deleted=1'
		);
	},

	clear: async ({
		locals,
		url
	}) => {
		const user = requireUser(
			locals.user,
			url.pathname
		);

		await clearExamHistoryForUser(
			user.id
		);

		redirect(
			303,
			'/history?cleared=1'
		);
	}
};
