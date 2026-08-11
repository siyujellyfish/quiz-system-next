export type PasswordChangeFormValues = {
	currentPassword: string;
	newPassword: string;
	confirmPassword: string;
};

export type PasswordChangeFieldErrors = Partial<
	Record<keyof PasswordChangeFormValues, string>
>;

export type PasswordChangeValidationResult =
	| {
		ok: true;
		input: PasswordChangeFormValues;
	}
	| {
		ok: false;
		errors: PasswordChangeFieldErrors;
	};

export function validatePasswordChangeForm(
	values: PasswordChangeFormValues
): PasswordChangeValidationResult {
	const errors: PasswordChangeFieldErrors = {};

	if (!values.currentPassword) {
		errors.currentPassword = '請輸入目前密碼';
	}

	if (!values.newPassword) {
		errors.newPassword = '請輸入新密碼';
	} else if (
		values.newPassword.length < 8 ||
		values.newPassword.length > 128
	) {
		errors.newPassword =
			'新密碼必須介於 8 至 128 個字元';
	}

	if (!values.confirmPassword) {
		errors.confirmPassword = '請再次輸入新密碼';
	} else if (
		values.newPassword &&
		values.newPassword !==
			values.confirmPassword
	) {
		errors.confirmPassword =
			'兩次輸入的新密碼不一致';
	}

	if (
		values.currentPassword &&
		values.newPassword &&
		values.currentPassword ===
			values.newPassword
	) {
		errors.newPassword =
			'新密碼不可與目前密碼相同';
	}

	if (Object.keys(errors).length > 0) {
		return {
			ok: false,
			errors
		};
	}

	return {
		ok: true,
		input: values
	};
}
