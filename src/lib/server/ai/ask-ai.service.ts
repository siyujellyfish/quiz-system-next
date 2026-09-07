import {
	eq
} from 'drizzle-orm';

import {
	db
} from '$lib/server/db';
import {
	questionOptions,
	questions
} from '$lib/server/db/schema';
import {
	CodexSandboxError
} from '$lib/server/integrations/codex-sandbox';
import {
	ChatgptNotConnectedError,
	ChatgptRelinkRequiredError,
	sendChatgptMessage
} from '$lib/server/profile/chatgpt.service';
import {
	getCodexUsageSnapshot
} from '$lib/server/profile/codex-usage.repository';
import {
	getExamAttemptForUser
} from '$lib/server/quiz/exam-attempt.repository';

import {
	createAiConversation,
	getAiConversationForUser,
	touchAiConversation
} from './conversation.repository';
import {
	verifyAiContextToken
} from './context-token';

export type AskAiErrorCode =
	| 'CHATGPT_NOT_CONNECTED'
	| 'CHATGPT_RELINK_REQUIRED'
	| 'CONVERSATION_NOT_FOUND'
	| 'INVALID_AI_CONTEXT'
	| 'QUESTION_NOT_FOUND'
	| 'QUESTION_CONFIGURATION_ERROR'
	| 'CODEX_RATE_LIMIT'
	| 'GENERATION_CANCELLED'
	| 'AI_TEMPORARY_UNAVAILABLE';

export class AskAiError extends Error {
	status: number;
	code: AskAiErrorCode;
	retryable: boolean;
	resetAt: string | null;

	constructor(input: {
		status: number;
		code: AskAiErrorCode;
		message: string;
		retryable?: boolean;
		resetAt?: string | null;
	}) {
		super(input.message);
		this.name = 'AskAiError';
		this.status = input.status;
		this.code = input.code;
		this.retryable = input.retryable ?? false;
		this.resetAt = input.resetAt ?? null;
	}
}

type AskAiQuestion = {
	id: string;
	bankId: string;
	prompt: string;
	explanation: string | null;
	options: Array<{
		id: string;
		content: string;
		isCorrect: boolean;
	}>;
};

const CONVERSATION_TOUCH_INTERVAL_MS =
	60 * 1000;

async function getAskAiQuestion(
	questionId: string
): Promise<AskAiQuestion> {
	const rows = await db
		.select({
			id: questions.id,
			bankId: questions.bankId,
			prompt: questions.prompt,
			explanation: questions.explanation,
			optionId: questionOptions.id,
			optionContent: questionOptions.content,
			optionIsCorrect:
				questionOptions.isCorrect,
			optionPosition:
				questionOptions.position
		})
		.from(questions)
		.innerJoin(
			questionOptions,
			eq(
				questionOptions.questionId,
				questions.id
			)
		)
		.where(
			eq(
				questions.id,
				questionId
			)
		)
		.orderBy(
			questionOptions.position
		);

	const first = rows[0];

	if (!first) {
		throw new AskAiError({
			status: 404,
			code: 'QUESTION_NOT_FOUND',
			message: '找不到這一題，請重新整理題目。'
		});
	}

	const options = rows.map((row) => ({
		id: row.optionId,
		content: row.optionContent,
		isCorrect: row.optionIsCorrect
	}));

	if (
		options.filter(
			(option) => option.isCorrect
		).length !== 1
	) {
		throw new AskAiError({
			status: 409,
			code: 'QUESTION_CONFIGURATION_ERROR',
			message: '這一題的正確答案設定異常，暫時無法詢問 AI。'
		});
	}

	return {
		id: first.id,
		bankId: first.bankId,
		prompt: first.prompt,
		explanation: first.explanation,
		options
	};
}

async function assertExamContext(input: {
	userId: string;
	question: AskAiQuestion;
	examAttemptId: string | null;
	selectedOptionId: string | null;
}) {
	if (!input.examAttemptId) {
		throw new AskAiError({
			status: 403,
			code: 'INVALID_AI_CONTEXT',
			message: '考試作答授權無效，請重新交卷後再試。'
		});
	}

	const attempt = await getExamAttemptForUser(
		input.examAttemptId,
		input.userId
	);
	const answers = attempt?.answers;

	if (
		!attempt?.submittedAt ||
		attempt.bankId !== input.question.bankId ||
		!answers ||
		!Object.prototype.hasOwnProperty.call(
			answers,
			input.question.id
		) ||
		(
			answers[input.question.id] ?? null
		) !== input.selectedOptionId
	) {
		throw new AskAiError({
			status: 403,
			code: 'INVALID_AI_CONTEXT',
			message: '只有完成交卷後的題目才能使用 AskAI。'
		});
	}
}

function getOptionLabel(index: number) {
	return String.fromCharCode(65 + index);
}

function buildQuestionContext(input: {
	question: AskAiQuestion;
	selectedOptionId: string | null;
	mode: 'practice' | 'wrong' | 'exam';
}) {
	const correctOption = input.question.options.find(
		(option) => option.isCorrect
	);
	const selectedOption = input.question.options.find(
		(option) =>
			option.id === input.selectedOptionId
	);
	const selectedCorrect = Boolean(
		selectedOption?.isCorrect
	);
	const options = input.question.options
		.map((option, index) => {
			const labels: string[] = [];

			if (option.isCorrect) {
				labels.push('正解');
			}

			if (
				option.id === input.selectedOptionId
			) {
				labels.push('作答');
			}

			const suffix = labels.length > 0
				? ` [${labels.join('、')}]`
				: '';

			return `${getOptionLabel(index)}. ${option.content}${suffix}`;
		})
		.join('\n');

	return [
		`模式: ${input.mode}`,
		`題目: ${input.question.prompt}`,
		'選項:',
		options,
		`作答: ${selectedOption?.content ?? '未作答'}`,
		`結果: ${selectedOption ? (selectedCorrect ? '答對' : '答錯') : '未作答'}`,
		`正解: ${correctOption?.content ?? '未設定'}`,
		`解析: ${input.question.explanation?.trim() || '無'}`
	].join('\n');
}

function shouldTouchConversation(
	updatedAt: Date
) {
	return Date.now() - updatedAt.getTime() >=
		CONVERSATION_TOUCH_INTERVAL_MS;
}

async function getRateLimitResetHint(
	userId: string
) {
	const snapshot = await getCodexUsageSnapshot(
		userId
	);
	const resetCandidates = [
		snapshot?.usage?.primary?.resetsAt,
		snapshot?.usage?.secondary?.resetsAt
	].filter(
		(value): value is string =>
			typeof value === 'string'
	);

	return resetCandidates.sort()[0] ?? null;
}

async function mapProviderError(
	userId: string,
	caughtError: unknown
): Promise<never> {
	if (
		caughtError instanceof
			ChatgptRelinkRequiredError
	) {
		throw new AskAiError({
			status: 409,
			code: 'CHATGPT_RELINK_REQUIRED',
			message: 'ChatGPT 登入狀態已失效，請重新連結後再試。'
		});
	}

	if (
		caughtError instanceof
			ChatgptNotConnectedError
	) {
		throw new AskAiError({
			status: 409,
			code: 'CHATGPT_NOT_CONNECTED',
			message: '請先在個人資料連結 ChatGPT。'
		});
	}

	if (
		caughtError instanceof CodexSandboxError
	) {
		if (caughtError.status === 499) {
			throw new AskAiError({
				status: 409,
				code: 'GENERATION_CANCELLED',
				message: '已停止產生回答。'
			});
		}

		if (
			caughtError.status === 409 ||
			caughtError.status === 410
		) {
			throw new AskAiError({
				status: 409,
				code: 'CHATGPT_RELINK_REQUIRED',
				message: 'ChatGPT 登入狀態已失效，請重新連結後再試。'
			});
		}

		if (caughtError.status === 429) {
			throw new AskAiError({
				status: 429,
				code: 'CODEX_RATE_LIMIT',
				message: '目前的 Codex 額度暫時不可用，請在額度重置後再試。',
				resetAt:
					await getRateLimitResetHint(
						userId
					)
			});
		}
	}

	throw new AskAiError({
		status: 503,
		code: 'AI_TEMPORARY_UNAVAILABLE',
		message: 'AI 題目助教暫時無法使用，請稍後重試。',
		retryable: true
	});
}

export async function sendAskAiMessage(input: {
	userId: string;
	sessionTokenHash: string;
	questionId: string;
	conversationId: string | null;
	aiContextToken: string | null;
	generationId: string;
	message: string;
}) {
	if (input.conversationId) {
		const conversation =
			await getAiConversationForUser(
				input.conversationId,
				input.userId
			);

		if (
			!conversation ||
			conversation.questionId !==
				input.questionId
		) {
			throw new AskAiError({
				status: 404,
				code: 'CONVERSATION_NOT_FOUND',
				message: '找不到這個 AI 對話，請建立新的對話。'
			});
		}

		try {
			const response = await sendChatgptMessage(
				input.userId,
				{
					threadId:
						conversation.providerThreadId,
					generationId:
						input.generationId,
					message: input.message,
					context: null
				}
			);

			if (
				shouldTouchConversation(
					conversation.updatedAt
				)
			) {
				try {
					await touchAiConversation(
						conversation.id,
						input.userId
					);
				} catch (touchError) {
					console.error(
						'Unable to touch AskAI conversation metadata',
						touchError
					);
				}
			}

			return {
				conversationId: conversation.id,
				message: response.message,
				usageUpdated: response.usageUpdated
			};
		} catch (caughtError) {
			return mapProviderError(
				input.userId,
				caughtError
			);
		}
	}

	if (!input.aiContextToken) {
		throw new AskAiError({
			status: 403,
			code: 'INVALID_AI_CONTEXT',
			message: '這一題的 AI 作答授權不存在或已過期，請重新作答後再試。'
		});
	}

	const tokenPayload = verifyAiContextToken({
		token: input.aiContextToken,
		sessionTokenHash:
			input.sessionTokenHash,
		userId: input.userId,
		questionId: input.questionId
	});

	if (!tokenPayload) {
		throw new AskAiError({
			status: 403,
			code: 'INVALID_AI_CONTEXT',
			message: '這一題的 AI 作答授權不存在或已過期，請重新作答後再試。'
		});
	}

	const question = await getAskAiQuestion(
		input.questionId
	);

	if (tokenPayload.mode === 'exam') {
		await assertExamContext({
			userId: input.userId,
			question,
			examAttemptId:
				tokenPayload.examAttemptId,
			selectedOptionId:
				tokenPayload.selectedOptionId
		});
	}

	const context = buildQuestionContext({
		question,
		selectedOptionId:
			tokenPayload.selectedOptionId,
		mode: tokenPayload.mode
	});

	try {
		const response = await sendChatgptMessage(
			input.userId,
			{
				threadId: null,
				generationId:
					input.generationId,
				message: input.message,
				context
			}
		);
		const conversation =
			await createAiConversation({
				userId: input.userId,
				questionId: input.questionId,
				providerThreadId:
					response.threadId
			});

		if (!conversation) {
			throw new Error(
				'Unable to persist AskAI conversation'
			);
		}

		return {
			conversationId: conversation.id,
			message: response.message,
			usageUpdated: response.usageUpdated
		};
	} catch (caughtError) {
		if (caughtError instanceof AskAiError) {
			throw caughtError;
		}

		return mapProviderError(
			input.userId,
			caughtError
		);
	}
}
