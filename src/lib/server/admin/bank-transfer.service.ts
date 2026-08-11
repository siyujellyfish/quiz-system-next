import {
	getAdminQuestionBankBySlug
} from '$lib/server/admin/bank.repository';

import {
	importAdminQuestionBank,
	type AdminBankTransferQuestion
} from '$lib/server/admin/bank-transfer.repository';

import type {
	AdminBankValidationResult
} from '$lib/server/admin/bank.service';

export const ADMIN_BANK_IMPORT_MAX_FILE_SIZE =
	5 * 1024 * 1024;
export const ADMIN_BANK_IMPORT_MAX_QUESTIONS = 5000;

export type AdminBankImportPreview = {
	questionCount: number;
	optionCount: number;
	sampleQuestions: Array<{
		prompt: string;
		optionCount: number;
	}>;
};

export type AdminBankImportParseResult =
	| {
		ok: true;
		questions: AdminBankTransferQuestion[];
		preview: AdminBankImportPreview;
		payload: string;
	}
	| {
		ok: false;
		message: string;
	};

export class AdminBankImportConflictError extends Error {
	constructor(message = '此 slug 已被其他題庫使用') {
		super(message);
		this.name = 'AdminBankImportConflictError';
	}
}

function isRecord(
	value: unknown
): value is Record<string, unknown> {
	return typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value);
}

function getQuestionErrorPrefix(index: number) {
	return `第 ${index + 1} 題`;
}

export function parseAdminBankImportJson(
	text: string
): AdminBankImportParseResult {
	let parsed: unknown;

	try {
		parsed = JSON.parse(text);
	} catch {
		return {
			ok: false,
			message: 'JSON 格式錯誤，請確認檔案內容'
		};
	}

	if (!Array.isArray(parsed)) {
		return {
			ok: false,
			message: '題庫 JSON 最外層必須是題目陣列'
		};
	}

	if (parsed.length === 0) {
		return {
			ok: false,
			message: '題庫至少需要 1 道題目'
		};
	}

	if (
		parsed.length >
		ADMIN_BANK_IMPORT_MAX_QUESTIONS
	) {
		return {
			ok: false,
			message: `單次最多可匯入 ${ADMIN_BANK_IMPORT_MAX_QUESTIONS} 道題目`
		};
	}

	const questions: AdminBankTransferQuestion[] = [];
	let optionCount = 0;

	for (
		let questionIndex = 0;
		questionIndex < parsed.length;
		questionIndex += 1
	) {
		const item = parsed[questionIndex];
		const prefix = getQuestionErrorPrefix(
			questionIndex
		);

		if (!isRecord(item)) {
			return {
				ok: false,
				message: `${prefix}：題目資料格式錯誤`
			};
		}

		if (typeof item.prompt !== 'string') {
			return {
				ok: false,
				message: `${prefix}：prompt 必須是字串`
			};
		}

		const prompt = item.prompt.trim();

		if (!prompt) {
			return {
				ok: false,
				message: `${prefix}：題目內容不可空白`
			};
		}

		if (!Array.isArray(item.options)) {
			return {
				ok: false,
				message: `${prefix}：options 必須是陣列`
			};
		}

		if (item.options.length < 2) {
			return {
				ok: false,
				message: `${prefix}：每題至少需要 2 個選項`
			};
		}

		const options: AdminBankTransferQuestion['options'] = [];
		let correctCount = 0;

		for (
			let optionIndex = 0;
			optionIndex < item.options.length;
			optionIndex += 1
		) {
			const option = item.options[optionIndex];

			if (!isRecord(option)) {
				return {
					ok: false,
					message: `${prefix}：第 ${optionIndex + 1} 個選項格式錯誤`
				};
			}

			if (typeof option.text !== 'string') {
				return {
					ok: false,
					message: `${prefix}：第 ${optionIndex + 1} 個選項 text 必須是字串`
				};
			}

			if (typeof option.isCorrect !== 'boolean') {
				return {
					ok: false,
					message: `${prefix}：第 ${optionIndex + 1} 個選項 isCorrect 必須是 boolean`
				};
			}

			const optionText = option.text.trim();

			if (!optionText) {
				return {
					ok: false,
					message: `${prefix}：第 ${optionIndex + 1} 個選項不可空白`
				};
			}

			if (option.isCorrect) {
				correctCount += 1;
			}

			options.push({
				text: optionText,
				isCorrect: option.isCorrect
			});
		}

		if (correctCount !== 1) {
			return {
				ok: false,
				message: `${prefix}：每題必須且只能設定 1 個正確答案`
			};
		}

		optionCount += options.length;
		questions.push({
			prompt,
			options
		});
	}

	return {
		ok: true,
		questions,
		preview: {
			questionCount: questions.length,
			optionCount,
			sampleQuestions: questions
				.slice(0, 3)
				.map((question) => ({
					prompt: question.prompt,
					optionCount:
						question.options.length
				}))
		},
		payload: JSON.stringify(questions)
	};
}

export async function ensureAdminBankImportSlugAvailable(
	slug: string
) {
	const existing =
		await getAdminQuestionBankBySlug(slug);

	if (existing) {
		throw new AdminBankImportConflictError();
	}
}

function isUniqueViolation(error: unknown) {
	return typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { code?: unknown }).code ===
			'23505';
}

export async function importValidatedAdminQuestionBank(
	bankValidation: Extract<
		AdminBankValidationResult,
		{ ok: true }
	>,
	questions: AdminBankTransferQuestion[]
) {
	await ensureAdminBankImportSlugAvailable(
		bankValidation.input.slug
	);

	try {
		return await importAdminQuestionBank({
			...bankValidation.input,
			questions
		});
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new AdminBankImportConflictError();
		}

		throw error;
	}
}
