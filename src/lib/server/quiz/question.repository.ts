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


export async function getQuestionWithOptionsByIdAndBank(
	questionId: string,
	bankId: string
) {
	return db
		.select({
			questionId: questions.id,
			prompt: questions.prompt,
			optionId: questionOptions.id,
			optionContent: questionOptions.content,
			optionPosition: questionOptions.position
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
		.orderBy(
			asc(
				questionOptions.position
			)
		);
}
