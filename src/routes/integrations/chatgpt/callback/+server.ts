import {
	redirect
} from '@sveltejs/kit';

import type {
	RequestHandler
} from './$types';

import {
	connectChatgptAccount
} from '$lib/server/profile/chatgpt.service';

const OAUTH_COOKIE_PATH = '/integrations/chatgpt';

function clearOAuthCookies(
	cookies: Parameters<RequestHandler>[0]['cookies']
) {
	cookies.delete(
		'chatgpt_oauth_state',
		{
			path: OAUTH_COOKIE_PATH
		}
	);
	cookies.delete(
		'chatgpt_oauth_verifier',
		{
			path: OAUTH_COOKIE_PATH
		}
	);
}

export const GET: RequestHandler = async ({
	locals,
	cookies,
	url
}) => {
	if (!locals.user) {
		clearOAuthCookies(cookies);

		redirect(
			303,
			`/login?redirectTo=${encodeURIComponent(
				'/profile'
			)}`
		);
	}

	const providerError =
		url.searchParams.get('error');
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const expectedState = cookies.get(
		'chatgpt_oauth_state'
	);
	const verifier = cookies.get(
		'chatgpt_oauth_verifier'
	);

	clearOAuthCookies(cookies);

	if (providerError) {
		redirect(
			303,
			'/profile?chatgptError=cancelled'
		);
	}

	if (
		!code ||
		!state ||
		!expectedState ||
		!verifier ||
		state !== expectedState
	) {
		redirect(
			303,
			'/profile?chatgptError=invalidCallback'
		);
	}

	try {
		await connectChatgptAccount(
			locals.user.id,
			code,
			`${url.origin}/integrations/chatgpt/callback`,
			verifier
		);
	} catch (caughtError) {
		console.error(
			'Unable to connect ChatGPT account',
			caughtError
		);

		redirect(
			303,
			'/profile?chatgptError=connectFailed'
		);
	}

	redirect(
		303,
		'/profile?chatgptLinked=1'
	);
};
