import type {
	PageServerLoad
} from './$types';

import {
	getAdminQuestionBanks
} from '$lib/server/admin/bank.repository';

export const load: PageServerLoad = async () => {
	return {
		banks: await getAdminQuestionBanks()
	};
};
