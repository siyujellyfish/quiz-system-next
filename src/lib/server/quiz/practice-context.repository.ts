import {
	and,
	eq,
	sql
} from 'drizzle-orm';


import {
	db
} from '$lib/server/db';


import {
	practiceProgress,
	questionBanks
} from '$lib/server/db/schema';


import type {
	PracticeQuestionState,
	PracticeQuestionsState
} from '$lib/types/quiz';


export async function getPracticeContextBySlug(
	userId: string,
	slug: string
) {
	const [context] = await db
		.select({
			bankId: questionBanks.id,
			bankSlug: questionBanks.slug,
			bankName: questionBanks.name,
			bankDescription:
				questionBanks.description,

			progressUserId:
				practiceProgress.userId,
			currentIndex:
				practiceProgress.currentIndex,
			answeredCount:
				practiceProgress.answeredCount,
			correctCount:
				practiceProgress.correctCount,
			totalQuestions:
				sql<number | null>`
					jsonb_array_length(
						${practiceProgress.questionsState}->'questions'
					)
				`,
			coverage:
				sql<PracticeQuestionsState['coverage'] | null>`
					(
						${practiceProgress.questionsState}->>'coverage'
					)::int
				`,
			shuffleOptions:
				sql<boolean | null>`
					(
						${practiceProgress.questionsState}->>'shuffleOptions'
					)::boolean
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
		.from(questionBanks)
		.leftJoin(
			practiceProgress,
			and(
				eq(
					practiceProgress.bankId,
					questionBanks.id
				),
				eq(
					practiceProgress.userId,
					userId
				)
			)
		)
		.where(
			eq(
				questionBanks.slug,
				slug
			)
		)
		.limit(1);

	return context ?? null;
}
