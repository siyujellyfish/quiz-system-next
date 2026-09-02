import {
	and,
	asc,
	eq,
	inArray,
	sql
} from 'drizzle-orm';


import {
	db
} from '$lib/server/db';


import {
	practiceProgress,
	questionOptions,
	questions
} from '$lib/server/db/schema';


import type {
	PracticeQuestionState,
	PracticeQuestionsState
} from '$lib/types/quiz';


export type PracticeSourceRow = {
	questionId: string;
	optionId: string;
	optionPosition: number;
};


const eligibleQuestionIds = db
	.selectDistinct({
		questionId:
			questionOptions.questionId
	})
	.from(questionOptions)
	.as('practice_eligible_question_ids');


export async function getPracticeQuestionIds(
	bankId: string
): Promise<string[]> {
	const rows = await db
		.select({
			questionId: questions.id
		})
		.from(questions)
		.innerJoin(
			eligibleQuestionIds,
			eq(
				eligibleQuestionIds.questionId,
				questions.id
			)
		)
		.where(
			eq(
				questions.bankId,
				bankId
			)
		)
		.orderBy(
			asc(questions.id)
		);

	return rows.map(
		(row) => row.questionId
	);
}


export async function getPracticeOptionRows(
	questionIds: string[]
): Promise<PracticeSourceRow[]> {
	if (questionIds.length === 0) {
		return [];
	}

	return db
		.select({
			questionId:
				questionOptions.questionId,
			optionId: questionOptions.id,
			optionPosition:
				questionOptions.position
		})
		.from(questionOptions)
		.where(
			inArray(
				questionOptions.questionId,
				questionIds
			)
		)
		.orderBy(
			asc(questionOptions.questionId),
			asc(questionOptions.position)
		);
}


export async function getPracticeSourceRows(
	bankId: string
): Promise<PracticeSourceRow[]> {
	return db
		.select({
			questionId: questions.id,
			optionId: questionOptions.id,
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
				questions.bankId,
				bankId
			)
		)
		.orderBy(
			asc(questions.id),
			asc(questionOptions.position)
		);
}


export async function replacePracticeProgress(
	userId: string,
	bankId: string,
	questionsState:
		PracticeQuestionsState
): Promise<void> {
	await db
		.insert(
			practiceProgress
		)
		.values({
			userId,
			bankId,
			questionsState,
			currentIndex: 0,
			answeredCount: 0,
			correctCount: 0
		})
		.onConflictDoUpdate({
			target: [
				practiceProgress.userId,
				practiceProgress.bankId
			],

			set: {
				questionsState,
				currentIndex: 0,
				answeredCount: 0,
				correctCount: 0
			}
		});
}


export async function getPracticeProgress(
	userId: string,
	bankId: string
) {
	const [progress] =
		await db
			.select({
				currentIndex:
					practiceProgress.currentIndex,
				answeredCount:
					practiceProgress.answeredCount,
				correctCount:
					practiceProgress.correctCount,
				totalQuestions:
					sql<number>`
						jsonb_array_length(
							${practiceProgress.questionsState}->'questions'
						)
					`,
				coverage:
					sql<PracticeQuestionsState['coverage']>`
						(
							${practiceProgress.questionsState}->>'coverage'
						)::int
					`,
				shuffleOptions:
					sql<boolean>`
						(
							${practiceProgress.questionsState}->>'shuffleOptions'
						)::boolean
					`,
				questionState:
					sql<PracticeQuestionState | null>`
						${practiceProgress.questionsState}
							->'questions'
							->${practiceProgress.currentIndex}
					`
			})
			.from(
				practiceProgress
			)
			.where(
				and(
					eq(
						practiceProgress.userId,
						userId
					),
					eq(
						practiceProgress.bankId,
						bankId
					)
				)
			)
			.limit(1);

	return progress ?? null;
}


export async function getPracticeAnswerProgress(
	userId: string,
	bankId: string
) {
	const [progress] =
		await db
			.select({
				currentIndex:
					practiceProgress.currentIndex,
				answeredCount:
					practiceProgress.answeredCount,
				correctCount:
					practiceProgress.correctCount,
				totalQuestions:
					sql<number>`
						jsonb_array_length(
							${practiceProgress.questionsState}->'questions'
						)
					`,
				questionState:
					sql<PracticeQuestionState | null>`
						${practiceProgress.questionsState}
							->'questions'
							->${practiceProgress.currentIndex}
					`,
				nextQuestionState:
					sql<PracticeQuestionState | null>`
						${practiceProgress.questionsState}
							->'questions'
							->(${practiceProgress.currentIndex} + 1)
					`
			})
			.from(practiceProgress)
			.where(
				and(
					eq(
						practiceProgress.userId,
						userId
					),
					eq(
						practiceProgress.bankId,
						bankId
					)
				)
			)
			.limit(1);

	return progress ?? null;
}


export async function getPracticeQuestionStateAtIndex(
	userId: string,
	bankId: string,
	currentIndex: number
): Promise<PracticeQuestionState | null> {
	const [row] = await db
		.select({
			questionState:
				sql<PracticeQuestionState | null>`
					${practiceProgress.questionsState}
						->'questions'
						->(${currentIndex}::int)
				`
		})
		.from(practiceProgress)
		.where(
			and(
				eq(
					practiceProgress.userId,
					userId
				),
				eq(
					practiceProgress.bankId,
					bankId
				)
			)
		)
		.limit(1);

	return row?.questionState ?? null;
}


export async function setPracticeCurrentIndex(
	userId: string,
	bankId: string,
	currentIndex: number
): Promise<void> {
	await db
		.update(practiceProgress)
		.set({
			currentIndex
		})
		.where(
			and(
				eq(
					practiceProgress.userId,
					userId
				),
				eq(
					practiceProgress.bankId,
					bankId
				)
			)
		);
}


export async function deletePracticeProgress(
	userId: string,
	bankId: string
): Promise<void> {
	await db
		.delete(practiceProgress)
		.where(
			and(
				eq(
					practiceProgress.userId,
					userId
				),
				eq(
					practiceProgress.bankId,
					bankId
				)
			)
		);
}


export async function getPracticeProgressSummariesByUser(
	userId: string
) {
	return db
		.select({
			bankId:
				practiceProgress.bankId,

			currentIndex:
				practiceProgress.currentIndex,

			totalQuestions:
				sql<number>`
					jsonb_array_length(
						${practiceProgress.questionsState}->'questions'
					)
				`,

			coverage:
				sql<PracticeQuestionsState['coverage']>`
					(
						${practiceProgress.questionsState}->>'coverage'
					)::int
				`,

			shuffleOptions:
				sql<boolean>`
					(
						${practiceProgress.questionsState}->>'shuffleOptions'
					)::boolean
				`
		})
		.from(practiceProgress)
		.where(
			eq(
				practiceProgress.userId,
				userId
			)
		);
}
