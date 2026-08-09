import {
	asc,
	countDistinct,
	eq
} from 'drizzle-orm';


import {
	db
} from '$lib/server/db';


import {
	questionBanks,
	questionOptions,
	questions
} from '$lib/server/db/schema';


export async function getQuestionBanksWithCount() {
	return db
		.select({
			id: questionBanks.id,
			slug: questionBanks.slug,
			name: questionBanks.name,
			description: questionBanks.description,

			questionCount:
				countDistinct(
					questionOptions.questionId
				)
		})
		.from(questionBanks)
		.leftJoin(
			questions,
			eq(
				questions.bankId,
				questionBanks.id
			)
		)
		.leftJoin(
			questionOptions,
			eq(
				questionOptions.questionId,
				questions.id
			)
		)
		.groupBy(
			questionBanks.id,
			questionBanks.slug,
			questionBanks.name,
			questionBanks.description
		)
		.orderBy(
			asc(questionBanks.name)
		);
}


export async function getQuestionBankById(
	bankId: string
) {
	const [bank] = await db
		.select({
			id: questionBanks.id,
			slug: questionBanks.slug,
			name: questionBanks.name,
			description:
				questionBanks.description
		})
		.from(questionBanks)
		.where(
			eq(
				questionBanks.id,
				bankId
			)
		)
		.limit(1);

	return bank ?? null;
}


export async function getQuestionBankBySlug(
	slug: string
) {
	const [bank] = await db
		.select({
			id: questionBanks.id,
			slug: questionBanks.slug,
			name: questionBanks.name,
			description:
				questionBanks.description
		})
		.from(questionBanks)
		.where(
			eq(
				questionBanks.slug,
				slug
			)
		)
		.limit(1);

	return bank ?? null;
}
