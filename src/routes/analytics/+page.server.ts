import {
	redirect
} from '@sveltejs/kit';

import type {
	PageServerLoad
} from './$types';

import {
	getExamLearningAnalyticsForUser
} from '$lib/server/quiz/exam-analytics.repository';

export const load: PageServerLoad = async ({
	locals,
	url
}) => {
	if (!locals.user) {
		redirect(
			303,
			`/login?redirectTo=${encodeURIComponent(
				url.pathname
			)}`
		);
	}

	return {
		analytics:
			await getExamLearningAnalyticsForUser(
				locals.user.id
			)
	};
};
