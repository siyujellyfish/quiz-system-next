import {
	describe,
	expect,
	it
} from 'vitest';

import {
	validatePasswordChangeForm
} from '$lib/server/profile/account.validation';

describe('validatePasswordChangeForm', () => {
	it('accepts a valid password change', () => {
		const result = validatePasswordChangeForm({
			currentPassword: 'current-password',
			newPassword: 'new-password-123',
			confirmPassword: 'new-password-123'
		});

		expect(result.ok).toBe(true);
	});

	it('requires every password field', () => {
		const result = validatePasswordChangeForm({
			currentPassword: '',
			newPassword: '',
			confirmPassword: ''
		});

		expect(result).toEqual({
			ok: false,
			errors: {
				currentPassword: '請輸入目前密碼',
				newPassword: '請輸入新密碼',
				confirmPassword: '請再次輸入新密碼'
			}
		});
	});

	it('enforces the signup password length rule', () => {
		const result = validatePasswordChangeForm({
			currentPassword: 'current-password',
			newPassword: 'short',
			confirmPassword: 'short'
		});

		expect(result).toEqual({
			ok: false,
			errors: {
				newPassword:
					'新密碼必須介於 8 至 128 個字元'
			}
		});
	});

	it('requires matching new passwords', () => {
		const result = validatePasswordChangeForm({
			currentPassword: 'current-password',
			newPassword: 'new-password-123',
			confirmPassword: 'different-password'
		});

		expect(result).toEqual({
			ok: false,
			errors: {
				confirmPassword:
					'兩次輸入的新密碼不一致'
			}
		});
	});

	it('rejects reusing the current password', () => {
		const result = validatePasswordChangeForm({
			currentPassword: 'same-password',
			newPassword: 'same-password',
			confirmPassword: 'same-password'
		});

		expect(result).toEqual({
			ok: false,
			errors: {
				newPassword:
					'新密碼不可與目前密碼相同'
			}
		});
	});
});
