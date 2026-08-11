import {
	fail
} from '@sveltejs/kit';

import type {
	Actions,
	PageServerLoad
} from './$types';

import {
	hashPassword
} from '$lib/server/auth/password';
import {
	requireAdmin
} from '$lib/server/auth/admin';
import {
	createAdminUser,
	deleteAdminUser,
	getAdminUserByUsername,
	getAdminUsers,
	setAdminUserRole
} from '$lib/server/admin/user.repository';

const usernamePattern =
	/^[a-zA-Z0-9_-]+$/;

export const load: PageServerLoad = async ({
	locals,
	url
}) => {
	const currentUser = requireAdmin(
		locals.user,
		url.pathname
	);

	return {
		users: await getAdminUsers(),
		currentUserId: currentUser.id
	};
};

export const actions: Actions = {
	create: async ({
		request,
		locals,
		url
	}) => {
		requireAdmin(
			locals.user,
			url.pathname
		);

		const data = await request.formData();
		const username = String(
			data.get('username') ?? ''
		).trim();
		const password = String(
			data.get('password') ?? ''
		);
		const confirmPassword = String(
			data.get('confirmPassword') ?? ''
		);
		const isAdmin =
			data.get('isAdmin') === 'on';

		if (
			!username ||
			!password ||
			!confirmPassword
		) {
			return fail(400, {
				action: 'create',
				username,
				isAdmin,
				message: '請完成使用者名稱與密碼欄位'
			});
		}

		if (
			username.length < 3 ||
			username.length > 64
		) {
			return fail(400, {
				action: 'create',
				username,
				isAdmin,
				message:
					'使用者名稱必須介於 3 至 64 個字元'
			});
		}

		if (!usernamePattern.test(username)) {
			return fail(400, {
				action: 'create',
				username,
				isAdmin,
				message:
					'使用者名稱只能包含英文、數字、底線與連字號'
			});
		}

		if (
			password.length < 8 ||
			password.length > 128
		) {
			return fail(400, {
				action: 'create',
				username,
				isAdmin,
				message:
					'密碼必須介於 8 至 128 個字元'
			});
		}

		if (password !== confirmPassword) {
			return fail(400, {
				action: 'create',
				username,
				isAdmin,
				message: '兩次輸入的密碼不一致'
			});
		}

		if (
			await getAdminUserByUsername(
				username
			)
		) {
			return fail(409, {
				action: 'create',
				username,
				isAdmin,
				message: '此使用者名稱已存在'
			});
		}

		try {
			await createAdminUser({
				username,
				passwordHash:
					await hashPassword(password),
				isAdmin
			});
		} catch (error) {
			console.error(
				'Failed to create managed user',
				error
			);

			return fail(500, {
				action: 'create',
				username,
				isAdmin,
				message:
					'建立使用者失敗，請稍後再試'
			});
		}

		return {
			action: 'create',
			success: true,
			message: `已建立使用者 ${username}`
		};
	},

	setAdmin: async ({
		request,
		locals,
		url
	}) => {
		const currentUser = requireAdmin(
			locals.user,
			url.pathname
		);

		const data = await request.formData();
		const userId = String(
			data.get('userId') ?? ''
		);
		const isAdmin =
			String(data.get('isAdmin')) === 'true';

		if (!userId) {
			return fail(400, {
				action: 'setAdmin',
				message: '缺少使用者識別碼'
			});
		}

		if (
			userId === currentUser.id &&
			!isAdmin
		) {
			return fail(400, {
				action: 'setAdmin',
				message:
					'無法移除目前登入帳號的管理員權限'
			});
		}

		try {
			const updatedUser =
				await setAdminUserRole(
					userId,
					isAdmin
				);

			if (!updatedUser) {
				return fail(404, {
					action: 'setAdmin',
					message: '找不到指定的使用者'
				});
			}

			return {
				action: 'setAdmin',
				success: true,
				message: isAdmin
					? `已授予 ${updatedUser.username} 管理員權限`
					: `已移除 ${updatedUser.username} 的管理員權限`
			};
		} catch (error) {
			console.error(
				'Failed to update managed user role',
				error
			);

			return fail(500, {
				action: 'setAdmin',
				message:
					'更新管理員權限失敗，請稍後再試'
			});
		}
	},

	delete: async ({
		request,
		locals,
		url
	}) => {
		const currentUser = requireAdmin(
			locals.user,
			url.pathname
		);

		const data = await request.formData();
		const userId = String(
			data.get('userId') ?? ''
		);

		if (!userId) {
			return fail(400, {
				action: 'delete',
				message: '缺少使用者識別碼'
			});
		}

		if (userId === currentUser.id) {
			return fail(400, {
				action: 'delete',
				message: '無法刪除目前登入的帳號'
			});
		}

		try {
			const deletedUser =
				await deleteAdminUser(userId);

			if (!deletedUser) {
				return fail(404, {
					action: 'delete',
					message: '找不到指定的使用者'
				});
			}

			return {
				action: 'delete',
				success: true,
				message:
					`已刪除使用者 ${deletedUser.username}`
			};
		} catch (error) {
			console.error(
				'Failed to delete managed user',
				error
			);

			return fail(500, {
				action: 'delete',
				message:
					'刪除使用者失敗，請稍後再試'
			});
		}
	}
};
