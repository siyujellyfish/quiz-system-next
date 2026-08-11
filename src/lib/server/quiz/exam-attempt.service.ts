import type {
	ExamAnswers,
	ExamResult
} from '$lib/types/quiz';

import {
	completeExamAttempt,
	createExamAttempt,
	getExamAttemptForUser,
	getLatestExamAttemptForUserBank
} from '$lib/server/quiz/exam-attempt.repository';

import {
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
	userId: string;
	bankId: string;
	answers: ExamAnswers;
}): Promise<ExamResult> {
	const attempt =
		await getLatestExamAttemptForUserBank(
			input.userId,
			input.bankId
		);

	if (!attempt) {
		throw new ExamAttemptError(
		409,
		'目前沒有可交卷的考試紀錄，請重新開始考試'
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
	const result = await gradeExam(
		input.bankId,
		input.answers,
		attempt.startedAt.getTime(),
		submittedAt.getTime()
	);

	const completed = await completeExamAttempt({
		attemptId: attempt.id,
		userId: input.userId,
		answers: input.answers,
		result,
		submittedAt
	});

	if (completed) {
		return result;
	}

	const latest = await getExamAttemptForUser(
		attempt.id,
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
