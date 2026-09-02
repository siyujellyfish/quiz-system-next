import {
	getAdminQuestionBankBySlug
} from '$lib/server/admin/bank.repository';

import {
	importAdminQuestionBank,
	type AdminBankTransferQuestion
} from '$lib/server/admin/bank-transfer.repository';

import {
	validateAdminBankForm
} from '$lib/server/admin/bank.service';

export const ADMIN_BANK_IMPORT_MAX_FILE_SIZE =
	5 * 1024 * 1024;
export const ADMIN_BANK_IMPORT_MAX_QUESTIONS = 5000;

export type AdminBankImportDocument = {
	version: 1;
	bank: {
		name: string;
		slug: string;
		description: string | null;
	};
	questions: AdminBankTransferQuestion[];
};

export type AdminBankImportPreview = {
	bank: AdminBankImportDocument['bank'];
	questionCount: number;
	optionCount: number;
	explanationCount: number;
	sampleQuestions: Array<{
		prompt: string;
		optionCount: number;
		hasExplanation: boolean;
	}>;
};

export type AdminBankImportParseResult =
	| {
		ok: true;
		document: AdminBankImportDocument;
		preview: AdminBankImportPreview;
		payload: string;
	}
	| {
		ok: false;
		message: string;
	};

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

function getQuestionSignature(
	question: AdminBankTransferQuestion
) {
	return JSON.stringify([
		question.prompt,
		question.options.map((option) => option.text)
	]);
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

	if (!isRecord(parsed)) {
		return {
			ok: false,
			message: '題庫 JSON 最外層必須是物件'
		};
	}

	if (parsed.version !== 1) {
		return {
			ok: false,
			message: '目前僅支援 version: 1 的題庫 JSON'
		};
	}

	if (!isRecord(parsed.bank)) {
		return {
			ok: false,
			message: 'bank 必須是題庫設定物件'
		};
	}

	const bankDescription = parsed.bank.description;

	if (
		bankDescription !== undefined &&
		bankDescription !== null &&
		typeof bankDescription !== 'string'
	) {
		return {
			ok: false,
			message: 'bank.description 必須是字串或 null'
		};
	}

	const bankValidation = validateAdminBankForm({
		name:
			typeof parsed.bank.name === 'string'
				? parsed.bank.name
				: '',
		slug:
			typeof parsed.bank.slug === 'string'
				? parsed.bank.slug
				: '',
		description:
			typeof bankDescription === 'string'
				? bankDescription
				: ''
	});

	if (!bankValidation.ok) {
		const firstMessage =
			bankValidation.errors.name ??
			bankValidation.errors.slug ??
			'題庫設定格式錯誤';

		return {
			ok: false,
			message: `bank：${firstMessage}`
		};
	}

	if (!Array.isArray(parsed.questions)) {
		return {
			ok: false,
			message: 'questions 必須是題目陣列'
		};
	}

	if (parsed.questions.length === 0) {
		return {
			ok: false,
			message: '題庫至少需要 1 道題目'
		};
	}

	if (
		parsed.questions.length >
		ADMIN_BANK_IMPORT_MAX_QUESTIONS
	) {
		return {
			ok: false,
			message: `單次最多可匯入 ${ADMIN_BANK_IMPORT_MAX_QUESTIONS} 道題目`
		};
	}

	const questions: AdminBankTransferQuestion[] = [];
	const signatures = new Set<string>();
	let optionCount = 0;
	let explanationCount = 0;

	for (
		let questionIndex = 0;
		questionIndex < parsed.questions.length;
		questionIndex += 1
	) {
		const item = parsed.questions[questionIndex];
		const prefix = getQuestionErrorPrefix(questionIndex);

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

		if (
			item.explanation !== undefined &&
			item.explanation !== null &&
			typeof item.explanation !== 'string'
		) {
			return {
				ok: false,
				message: `${prefix}：explanation 必須是字串或 null`
			};
		}

		const explanation =
			typeof item.explanation === 'string'
				? item.explanation.trim() || null
				: null;

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

		const question: AdminBankTransferQuestion = {
			prompt,
			explanation,
			options
		};
		const signature = getQuestionSignature(question);

		if (signatures.has(signature)) {
			return {
				ok: false,
				message: `${prefix}：題幹與選項內容和前面的題目重複`
			};
		}

		signatures.add(signature);
		optionCount += options.length;
		if (explanation) {
			explanationCount += 1;
		}
		questions.push(question);
	}

	const document: AdminBankImportDocument = {
		version: 1,
		bank: bankValidation.input,
		questions
	};

	return {
		ok: true,
		document,
		preview: {
			bank: document.bank,
			questionCount: questions.length,
			optionCount,
			explanationCount,
			sampleQuestions: questions
				.slice(0, 3)
				.map((question) => ({
					prompt: question.prompt,
					optionCount: question.options.length,
					hasExplanation: question.explanation !== null
				}))
		},
		payload: JSON.stringify(document)
	};
}

export async function getAdminBankImportMode(slug: string) {
	const existing = await getAdminQuestionBankBySlug(slug);
	return existing ? ('sync' as const) : ('create' as const);
}

export async function importAdminBankDocument(
	document: AdminBankImportDocument
) {
	return importAdminQuestionBank({
		...document.bank,
		questions: document.questions
	});
}
