import {
	error,
	redirect
} from '@sveltejs/kit';

import type {
	RequestHandler
} from './$types';

import {
	buildChatgptAuthorizeUrl,
	generateOAuthState,
	generatePkcePair,
	getChatgptOAuthConfig
} from '$lib/server/integrations/chatgpt';

const OAUTH_COOKIE_MAX_AGE = 10 * 60;

export const GET: RequestHandler = async ({
	locals,
	cookies,
	url
}) => {
	if (!locals.user) {
		redirect(
			303,
			`/login?redirectTo=${encodeURIComponent(
				'/profile'
			)}`
		);
	}

	const config = getChatgptOAuthConfig();

	if (!config) {
		error(
			503,
			'ChatGPT 連結功能尚未設定'
		);
	}

	const state = generateOAuthState();
	const pkce = generatePkcePair();
	const secure = url.protocol === 'https:';
	const cookieOptions = {
		httpOnly: true,
		sameSite: 'lax' as const,
		secure,
		path: '/integrations/chatgpt',
		maxAge: OAUTH_COOKIE_MAX_AGE
	};

	cookies.set(
		'chatgpt_oauth_state',
		state,
		cookieOptions
	);
	cookies.set(
		'chatgpt_oauth_verifier',
		pkce.verifier,
		cookieOptions
	);

	const redirectUri =
		`${url.origin}/integrations/chatgpt/callback`;
	const authorizeUrl = buildChatgptAuthorizeUrl(
		config,
		redirectUri,
		state,
		pkce.challenge
	);

	redirect(
		303,
		authorizeUrl
	);
};
