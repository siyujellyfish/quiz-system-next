import {
	fail,
	redirect
} from '@sveltejs/kit';

import type {
	Actions,
	PageServerLoad
} from './$types';

import {
	deleteSession,
	getCurrentSessionTokenHash
} from '$lib/server/auth/session';

import {
	AccountNotFoundError,
	AccountPasswordConflictError,
	changeAccountPassword,
	InvalidCurrentPasswordError
} from '$lib/server/profile/account.service';

import {
	validatePasswordChangeForm
} from '$lib/server/profile/account.validation';

export const load: PageServerLoad =
	async ({ locals, url }) => {
		if (!locals.user) {
			redirect(
				303,
				`/login?redirectTo=${encodeURIComponent(
					url.pathname
				)}`
			);
		}

		return {
			user: locals.user,
			passwordChanged:
				url.searchParams.get(
					'passwordChanged'
				) === '1'
		};
	};

export const actions: Actions = {
	changePassword: async ({
		request,
		locals,
		cookies,
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

		const formData = await request.formData();
		const validation = validatePasswordChangeForm({
			currentPassword: String(
				formData.get('currentPassword') ?? ''
			),
			newPassword: String(
				formData.get('newPassword') ?? ''
			),
			confirmPassword: String(
				formData.get('confirmPassword') ?? ''
			)
		});

		if (!validation.ok) {
			return fail(400, {
				errors: validation.errors,
				message: '請修正密碼設定'
			});
		}

		const currentSessionTokenHash =
			getCurrentSessionTokenHash(cookies);

		if (!currentSessionTokenHash) {
			redirect(
				303,
				`/login?redirectTo=${encodeURIComponent(
					url.pathname
				)}`
			);
		}

		try {
			await changeAccountPassword({
				userId: locals.user.id,
				currentSessionTokenHash,
				currentPassword:
					validation.input.currentPassword,
				newPassword:
					validation.input.newPassword
			});
		} catch (caughtError) {
			if (
				caughtError instanceof
				InvalidCurrentPasswordError
			) {
				return fail(400, {
					errors: {
					currentPassword:
						caughtError.message,
					newPassword: undefined,
					confirmPassword: undefined
				},
				message: '目前密碼驗證失敗'
				});
			}

			if (
				caughtError instanceof
				AccountPasswordConflictError
			) {
				return fail(409, {
					errors: {
					currentPassword: undefined,
					newPassword: undefined,
					confirmPassword: undefined
				},
				message: caughtError.message
				});
			}

			if (
				caughtError instanceof
				AccountNotFoundError
			) {
				await deleteSession(cookies);

				redirect(
					303,
					'/login'
				);
			}

			throw caughtError;
		}

		redirect(
			303,
			'/profile?passwordChanged=1'
		);
	}
};
