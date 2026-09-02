import {
	asc,
	count,
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


function getOptionQuestionIdsSubquery() {
	return db
		.select({
			questionId:
				questionOptions.questionId
		})
		.from(questionOptions)
		.groupBy(
			questionOptions.questionId
		)
		.as('option_question_ids');
}


export async function getQuestionBanksWithCount() {
	const optionQuestionIds =
		getOptionQuestionIdsSubquery();

	return db
		.select({
			id: questionBanks.id,
			slug: questionBanks.slug,
			name: questionBanks.name,
			description: questionBanks.description,

			questionCount:
				count(
					optionQuestionIds.questionId
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
			optionQuestionIds,
			eq(
				optionQuestionIds.questionId,
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


export async function getQuestionBankWithCountBySlug(
	slug: string
) {
	const optionQuestionIds =
		getOptionQuestionIdsSubquery();

	const [bank] = await db
		.select({
			id: questionBanks.id,
			slug: questionBanks.slug,
			name: questionBanks.name,
			description:
				questionBanks.description,
			questionCount:
				count(
					optionQuestionIds.questionId
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
			optionQuestionIds,
			eq(
				optionQuestionIds.questionId,
				questions.id
			)
		)
		.where(
			eq(
				questionBanks.slug,
				slug
			)
		)
		.groupBy(
			questionBanks.id,
			questionBanks.slug,
			questionBanks.name,
			questionBanks.description
		)
		.limit(1);

	return bank ?? null;
}
