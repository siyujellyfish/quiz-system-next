import {
	createAdminQuestionBank,
	getAdminQuestionBankById,
	getAdminQuestionBankBySlug,
	updateAdminQuestionBank
} from '$lib/server/admin/bank.repository';

export type AdminBankFormValues = {
	name: string;
	slug: string;
	description: string;
};

export type AdminBankFieldErrors = Partial<
	Record<keyof AdminBankFormValues, string>
>;

export type AdminBankValidationResult =
	| {
		ok: true;
		values: AdminBankFormValues;
		input: {
			name: string;
			slug: string;
			description: string | null;
		};
	}
	| {
		ok: false;
		values: AdminBankFormValues;
		errors: AdminBankFieldErrors;
	};

export class AdminBankConflictError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AdminBankConflictError';
	}
}

export class AdminBankNotFoundError extends Error {
	constructor() {
		super('找不到指定的題庫');
		this.name = 'AdminBankNotFoundError';
	}
}

export function validateAdminBankForm(
	values: AdminBankFormValues
): AdminBankValidationResult {
	const normalized: AdminBankFormValues = {
		name: values.name.trim(),
		slug: values.slug.trim(),
		description: values.description.trim()
	};

	const errors: AdminBankFieldErrors = {};

	if (!normalized.name) {
		errors.name = '請輸入題庫名稱';
	} else if (normalized.name.length > 128) {
		errors.name = '題庫名稱不可超過 128 個字元';
	}

	if (!normalized.slug) {
		errors.slug = '請輸入 slug';
	} else if (normalized.slug.length > 64) {
		errors.slug = 'slug 不可超過 64 個字元';
	} else if (
		!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
			normalized.slug
		)
	) {
		errors.slug =
			'slug 僅能使用小寫英文字母、數字與單一連字號';
	}

	if (Object.keys(errors).length > 0) {
		return {
			ok: false,
			values: normalized,
			errors
		};
	}

	return {
		ok: true,
		values: normalized,
		input: {
			name: normalized.name,
			slug: normalized.slug,
			description:
				normalized.description || null
		}
	};
}

function isUniqueViolation(
	error: unknown
): boolean {
	return typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { code?: unknown }).code ===
			'23505';
}

export async function createValidatedAdminBank(
	validation: Extract<
		AdminBankValidationResult,
		{ ok: true }
	>
) {
	const existing =
		await getAdminQuestionBankBySlug(
			validation.input.slug
		);

	if (existing) {
		throw new AdminBankConflictError(
			'此 slug 已被其他題庫使用'
		);
	}

	try {
		return await createAdminQuestionBank(
			validation.input
		);
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new AdminBankConflictError(
				'此 slug 已被其他題庫使用'
			);
		}

		throw error;
	}
}

export async function updateValidatedAdminBank(
	bankId: string,
	validation: Extract<
		AdminBankValidationResult,
		{ ok: true }
	>
) {
	const current =
		await getAdminQuestionBankById(
			bankId
		);

	if (!current) {
		throw new AdminBankNotFoundError();
	}

	const existing =
		await getAdminQuestionBankBySlug(
			validation.input.slug,
			bankId
		);

	if (existing) {
		throw new AdminBankConflictError(
			'此 slug 已被其他題庫使用'
		);
	}

	try {
		const updated =
			await updateAdminQuestionBank(
				bankId,
				validation.input
			);

		if (!updated) {
			throw new AdminBankNotFoundError();
		}

		return updated;
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new AdminBankConflictError(
				'此 slug 已被其他題庫使用'
			);
		}

		throw error;
	}
}
