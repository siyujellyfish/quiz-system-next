import {
	and,
	asc,
	eq
} from 'drizzle-orm';


import {
	db
} from '$lib/server/db';


import {
	questionOptions,
	questions
} from '$lib/server/db/schema';


export async function getQuestionByIdAndBank(
	questionId: string,
	bankId: string
) {
	const [question] =
		await db
			.select({
				id: questions.id,
				prompt: questions.prompt
			})
			.from(questions)
			.where(
				and(
					eq(
						questions.id,
						questionId
					),
					eq(
						questions.bankId,
						bankId
					)
				)
			)
			.limit(1);

	return question ?? null;
}


export async function getQuestionOptions(
	questionId: string
) {
	return db
		.select({
			id: questionOptions.id,
			content: questionOptions.content,
			position: questionOptions.position
		})
		.from(questionOptions)
		.where(
			eq(
				questionOptions.questionId,
				questionId
			)
		)
		.orderBy(
			asc(
				questionOptions.position
			)
		);
}