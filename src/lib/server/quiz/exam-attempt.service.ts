import type {
	ExamAnswers,
	ExamResult
} from '$lib/types/quiz';

import {
	completeExamAttempt,
	createExamAttempt,
	getExamAttemptForUser
} from '$lib/server/quiz/exam-attempt.repository';

import {
	ExamError,
	gradeExam
} from '$lib/server/quiz/exam.service';

export class ExamAttemptError extends Error {
	status: number;

	constructor(
		status: number,
		message: string
	) {
		super(message);
		this.name = 'ExamAttemptError';
		this.status = status;
	}
}

export async function startUserExamAttempt(input: {
	userId: string;
	bankId: string;
	bankName: string;
	totalQuestions: number;
}) {
	const startedAt = new Date();
	const attempt = await createExamAttempt({
		...input,
		startedAt
	});

	if (!attempt) {
		throw new ExamAttemptError(
		500,
		'無法建立考試紀錄'
		);
	}

	return attempt;
}

async function gradeSubmittedAttempt(
	bankId: string,
	attempt: {
		startedAt: Date;
		submittedAt: Date;
		answers: ExamAnswers | null;
	},
	fallbackAnswers: ExamAnswers
): Promise<ExamResult> {
	return gradeExam(
		bankId,
		attempt.answers ?? fallbackAnswers,
		attempt.startedAt.getTime(),
		attempt.submittedAt.getTime()
	);
}

export async function submitUserExamAttempt(input: {
	attemptId: string;
	userId: string;
	bankId: string;
	answers: ExamAnswers;
}): Promise<ExamResult> {
	const attempt = await getExamAttemptForUser(
		input.attemptId,
		input.userId
	);

	if (!attempt) {
		throw new ExamAttemptError(
		404,
		'找不到指定的考試紀錄'
		);
	}

	if (attempt.bankId !== input.bankId) {
		throw new ExamAttemptError(
		409,
		'考試紀錄與目前題庫不一致'
		);
	}

	if (attempt.submittedAt) {
		return gradeSubmittedAttempt(
			input.bankId,
			{
				startedAt: attempt.startedAt,
				submittedAt: attempt.submittedAt,
				answers: attempt.answers
			},
			input.answers
		);
	}

	const submittedAt = new Date();
	let result: ExamResult;

	try {
		result = await gradeExam(
			input.bankId,
			input.answers,
			attempt.startedAt.getTime(),
			submittedAt.getTime()
		);
	} catch (caught) {
		if (caught instanceof ExamError) {
			throw caught;
		}

		throw caught;
	}

	const completed = await completeExamAttempt({
		attemptId: input.attemptId,
		userId: input.userId,
		answers: input.answers,
		result,
		submittedAt
	});

	if (completed) {
		return result;
	}

	const latest = await getExamAttemptForUser(
		input.attemptId,
		input.userId
	);

	if (!latest?.submittedAt) {
		throw new ExamAttemptError(
		409,
		'考試紀錄已被其他操作更新，請重新整理後再試'
		);
	}

	return gradeSubmittedAttempt(
		input.bankId,
		{
			startedAt: latest.startedAt,
			submittedAt: latest.submittedAt,
			answers: latest.answers
		},
		input.answers
	);
}
