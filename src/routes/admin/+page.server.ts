import type {
	PageServerLoad
} from './$types';

import {
	getAdminDashboardStats
} from '$lib/server/admin/bank.repository';

export const load: PageServerLoad = async () => {
	return {
		stats: await getAdminDashboardStats()
	};
};
