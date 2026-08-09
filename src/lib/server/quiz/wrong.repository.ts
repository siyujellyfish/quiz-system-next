import {
	and,
	countDistinct,
	eq
} from 'drizzle-orm';


import {
	db
} from '$lib/server/db';


import {
	questionOptions,
	questions,
	userWrongQuestions
} from '$lib/server/db/schema';


export async function getWrongQuestionCountsByUser(
	userId: string
) {
	return db
		.select({
			bankId: questions.bankId,
			wrongCount: countDistinct(
				userWrongQuestions.questionId
			)
		})
		.from(userWrongQuestions)
		.innerJoin(
			questions,
			eq(
				questions.id,
				userWrongQuestions.questionId
			)
		)
		.innerJoin(
			questionOptions,
			eq(
				questionOptions.questionId,
				questions.id
			)
		)
		.where(
			eq(
				userWrongQuestions.userId,
				userId
			)
		)
		.groupBy(
			questions.bankId
		);
}


export async function getWrongQuestionIds(
	userId: string,
	bankId: string
): Promise<string[]> {
	const rows = await db
		.selectDistinct({
			questionId:
				userWrongQuestions.questionId
		})
		.from(userWrongQuestions)
		.innerJoin(
			questions,
			and(
				eq(
					questions.id,
					userWrongQuestions.questionId
				),
				eq(
					questions.bankId,
					bankId
				)
			)
		)
		.innerJoin(
			questionOptions,
			eq(
				questionOptions.questionId,
				questions.id
			)
		)
		.where(
			eq(
				userWrongQuestions.userId,
				userId
			)
		);

	return rows.map(
		(row) => row.questionId
	);
}


export async function hasWrongQuestion(
	userId: string,
	bankId: string,
	questionId: string
): Promise<boolean> {
	const [row] = await db
		.select({
			questionId:
				userWrongQuestions.questionId
		})
		.from(userWrongQuestions)
		.innerJoin(
			questions,
			and(
				eq(
					questions.id,
					userWrongQuestions.questionId
				),
				eq(
					questions.bankId,
					bankId
				)
			)
		)
		.where(
			and(
				eq(
					userWrongQuestions.userId,
					userId
				),
				eq(
					userWrongQuestions.questionId,
					questionId
				)
			)
		)
		.limit(1);

	return Boolean(row);
}


export async function deleteWrongQuestion(
	userId: string,
	questionId: string
): Promise<void> {
	await db
		.delete(userWrongQuestions)
		.where(
			and(
				eq(
					userWrongQuestions.userId,
					userId
				),
				eq(
					userWrongQuestions.questionId,
					questionId
				)
			)
		);
}
