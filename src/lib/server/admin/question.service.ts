import {
	createAdminQuestion,
	getAdminQuestionEditor,
	updateAdminQuestion
} from '$lib/server/admin/question.repository';

export type AdminQuestionOptionFormValue = {
	id: string | null;
	content: string;
	isCorrect: boolean;
};

export type AdminQuestionFormValues = {
	prompt: string;
	options: AdminQuestionOptionFormValue[];
};

export type AdminQuestionFieldErrors = {
	prompt?: string;
	options?: string;
	optionContent?: Record<number, string>;
};

export type AdminQuestionValidationResult =
	| {
		ok: true;
		values: AdminQuestionFormValues;
		input: {
			prompt: string;
			options: Array<{
				id: string | null;
				content: string;
				isCorrect: boolean;
				position: number;
			}>;
		};
	}
	| {
		ok: false;
		values: AdminQuestionFormValues;
		errors: AdminQuestionFieldErrors;
	};

export class AdminQuestionNotFoundError extends Error {
	constructor() {
		super('找不到指定的題目');
		this.name = 'AdminQuestionNotFoundError';
	}
}

export class AdminQuestionOptionConflictError extends Error {
	constructor() {
		super('題目選項已被其他操作修改，請重新整理後再試');
		this.name = 'AdminQuestionOptionConflictError';
	}
}

export function parseAdminQuestionOptions(
	value: FormDataEntryValue | null
): AdminQuestionOptionFormValue[] | null {
	if (typeof value !== 'string') {
		return null;
	}

	let parsed: unknown;

	try {
		parsed = JSON.parse(value);
	} catch {
		return null;
	}

	if (!Array.isArray(parsed)) {
		return null;
	}

	const options: AdminQuestionOptionFormValue[] = [];

	for (const item of parsed) {
		if (
			typeof item !== 'object' ||
			item === null
		) {
			return null;
		}

		const candidate = item as {
			id?: unknown;
			content?: unknown;
			isCorrect?: unknown;
		};

		if (
			candidate.id !== null &&
			candidate.id !== undefined &&
			typeof candidate.id !== 'string'
		) {
			return null;
		}

		if (
			typeof candidate.content !== 'string' ||
			typeof candidate.isCorrect !== 'boolean'
		) {
			return null;
		}

		options.push({
			id:
				typeof candidate.id === 'string'
					? candidate.id
					: null,
			content: candidate.content,
			isCorrect: candidate.isCorrect
		});
	}

	return options;
}

export function validateAdminQuestionForm(
	values: AdminQuestionFormValues
): AdminQuestionValidationResult {
	const normalized: AdminQuestionFormValues = {
		prompt: values.prompt.trim(),
		options: values.options.map(
			(option) => ({
				id: option.id,
				content: option.content.trim(),
				isCorrect: option.isCorrect
			})
		)
	};

	const errors: AdminQuestionFieldErrors = {};
	const optionContentErrors: Record<number, string> = {};

	if (!normalized.prompt) {
		errors.prompt = '請輸入題目內容';
	}

	if (normalized.options.length < 2) {
		errors.options = '每題至少需要 2 個選項';
	}

	for (
		let index = 0;
		index < normalized.options.length;
		index += 1
	) {
		if (!normalized.options[index].content) {
			optionContentErrors[index] =
				'請輸入選項內容';
		}
	}

	if (Object.keys(optionContentErrors).length > 0) {
		errors.optionContent = optionContentErrors;
	}

	const correctCount = normalized.options.filter(
		(option) => option.isCorrect
	).length;

	if (correctCount !== 1) {
		errors.options =
			'每題必須且只能設定 1 個正確答案';
	}

	const existingIds = normalized.options
		.map((option) => option.id)
		.filter(
			(id): id is string =>
				id !== null
		);

	if (
		new Set(existingIds).size !==
		existingIds.length
	) {
		errors.options = '選項資料重複，請重新整理後再試';
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
			prompt: normalized.prompt,
			options: normalized.options.map(
				(option, position) => ({
					...option,
					position
				})
			)
		}
	};
}

export async function createValidatedAdminQuestion(
	bankId: string,
	validation: Extract<
		AdminQuestionValidationResult,
		{ ok: true }
	>
) {
	if (
		validation.input.options.some(
			(option) => option.id !== null
		)
	) {
		throw new AdminQuestionOptionConflictError();
	}

	return createAdminQuestion(
		bankId,
		validation.input
	);
}

export async function updateValidatedAdminQuestion(
	bankId: string,
	questionId: string,
	validation: Extract<
		AdminQuestionValidationResult,
		{ ok: true }
	>
) {
	const current = await getAdminQuestionEditor(
		bankId,
		questionId
	);

	if (!current) {
		throw new AdminQuestionNotFoundError();
	}

	const currentIds = new Set(
		current.options.map((option) => option.id)
	);

	const hasForeignId =
		validation.input.options.some(
			(option) =>
				option.id !== null &&
				!currentIds.has(option.id)
		);

	if (hasForeignId) {
		throw new AdminQuestionOptionConflictError();
	}

	const updated = await updateAdminQuestion(
		bankId,
		questionId,
		validation.input
	);

	if (!updated) {
		throw new AdminQuestionNotFoundError();
	}

	return updated;
}
