import {
	json
} from '@sveltejs/kit';

import type {
	RequestHandler
} from './$types';

import {
	getChatgptDeviceLoginStatus
} from '$lib/server/profile/chatgpt.service';

export const GET: RequestHandler = async ({
	locals,
	url
}) => {
	if (!locals.user) {
		return json(
			{
				error: 'Unauthorized'
			},
			{
				status: 401
			}
		);
	}

	const loginId = url.searchParams
		.get('loginId')
		?.trim();

	if (!loginId || loginId.length > 255) {
		return json(
			{
				error: 'Invalid loginId'
			},
			{
				status: 400
			}
		);
	}

	try {
		const status = await getChatgptDeviceLoginStatus(
			locals.user.id,
			loginId
		);

		return json(status);
	} catch (caughtError) {
		console.error(
			'Unable to check ChatGPT device login',
			caughtError
		);

		return json(
			{
				status: 'pending',
				error: null,
				account: null
			},
			{
				status: 503
			}
		);
	}
};
