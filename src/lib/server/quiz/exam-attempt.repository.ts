import {
	and,
	desc,
	eq,
	isNotNull,
	isNull
} from 'drizzle-orm';

import {
	db
} from '$lib/server/db';

import {
	examAttempts
} from '$lib/server/db/schema';

import type {
	ExamAnswers,
	ExamResult
} from '$lib/types/quiz';

export async function createExamAttempt(input: {
	userId: string;
	bankId: string;
	bankName: string;
	totalQuestions: number;
	startedAt: Date;
}) {
	return db.transaction(async (tx) => {
		await tx
			.delete(examAttempts)
			.where(
				and(
					eq(
						examAttempts.userId,
						input.userId
					),
					eq(
						examAttempts.bankId,
						input.bankId
					),
					isNull(
						examAttempts.submittedAt
					)
				)
			);

		const [attempt] = await tx
			.insert(examAttempts)
			.values({
				userId: input.userId,
				bankId: input.bankId,
				bankName: input.bankName,
				totalQuestions:
					input.totalQuestions,
				startedAt: input.startedAt
			})
			.returning({
				id: examAttempts.id,
				startedAt:
					examAttempts.startedAt
			});

		return attempt;
	});
}

export async function getExamAttemptForUser(
	attemptId: string,
	userId: string
) {
	const [attempt] = await db
		.select()
		.from(examAttempts)
		.where(
			and(
				eq(
					examAttempts.id,
					attemptId
				),
				eq(
					examAttempts.userId,
					userId
				)
			)
		)
		.limit(1);

	return attempt ?? null;
}

export async function completeExamAttempt(input: {
	attemptId: string;
	userId: string;
	answers: ExamAnswers;
	result: ExamResult;
	submittedAt: Date;
}) {
	const [attempt] = await db
		.update(examAttempts)
		.set({
			submittedAt: input.submittedAt,
			answeredCount:
				input.result.answeredCount,
			correctCount:
				input.result.correctCount,
			incorrectCount:
				input.result.incorrectCount,
			elapsedSeconds:
				input.result.elapsedSeconds,
			answers: input.answers
		})
		.where(
			and(
				eq(
					examAttempts.id,
					input.attemptId
				),
				eq(
					examAttempts.userId,
					input.userId
				),
				isNull(
					examAttempts.submittedAt
				)
			)
		)
		.returning({
			id: examAttempts.id
		});

	return attempt ?? null;
}

export async function getExamHistoryForUser(
	userId: string
) {
	return db
		.select({
			id: examAttempts.id,
			bankId: examAttempts.bankId,
			bankName: examAttempts.bankName,
			startedAt: examAttempts.startedAt,
			submittedAt: examAttempts.submittedAt,
			totalQuestions:
				examAttempts.totalQuestions,
			answeredCount:
				examAttempts.answeredCount,
			correctCount:
				examAttempts.correctCount,
			incorrectCount:
				examAttempts.incorrectCount,
			elapsedSeconds:
				examAttempts.elapsedSeconds
		})
		.from(examAttempts)
		.where(
			and(
				eq(
					examAttempts.userId,
					userId
				),
				isNotNull(
					examAttempts.submittedAt
				)
			)
		)
		.orderBy(
			desc(examAttempts.submittedAt)
		);
}

export async function deleteExamHistoryForUser(
	attemptId: string,
	userId: string
): Promise<boolean> {
	const [deleted] = await db
		.delete(examAttempts)
		.where(
			and(
				eq(
					examAttempts.id,
					attemptId
				),
				eq(
					examAttempts.userId,
					userId
				),
				isNotNull(
					examAttempts.submittedAt
				)
			)
		)
		.returning({
			id: examAttempts.id
		});

	return Boolean(deleted);
}

export async function clearExamHistoryForUser(
	userId: string
): Promise<number> {
	const deleted = await db
		.delete(examAttempts)
		.where(
			and(
				eq(
					examAttempts.userId,
					userId
				),
				isNotNull(
					examAttempts.submittedAt
				)
			)
		)
		.returning({
			id: examAttempts.id
		});

	return deleted.length;
}
