import {
	and,
	asc,
	eq
} from 'drizzle-orm';


import {
	db
} from '$lib/server/db';


import {
	practiceProgress,
	questionOptions,
	questions
} from '$lib/server/db/schema';


type PracticeProgressInsert =
	typeof practiceProgress.$inferInsert;

type PracticeQuestionsState =
	PracticeProgressInsert['questionsState'];


export type PracticeSourceRow = {
	questionId: string;
	optionId: string;
	optionPosition: number;
};


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
			.select()
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


export async function getPracticeProgressesByUser(
	userId: string
) {
	return db
		.select({
			bankId:
				practiceProgress.bankId,

			currentIndex:
				practiceProgress.currentIndex,

			answeredCount:
				practiceProgress.answeredCount,

			correctCount:
				practiceProgress.correctCount,

			questionsState:
				practiceProgress.questionsState
		})
		.from(practiceProgress)
		.where(
			eq(
				practiceProgress.userId,
				userId
			)
		);
}
