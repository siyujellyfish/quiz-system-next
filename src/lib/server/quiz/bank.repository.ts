import {
	asc,
	eq,
	sql
} from 'drizzle-orm';


import {
	db
} from '$lib/server/db';


import {
	questionBanks,
	questionOptions,
	questions
} from '$lib/server/db/schema';


const validQuestionCount = sql<number>`
	(
		select count(*)::int
		from ${questions}
		where ${questions.bankId} = ${questionBanks.id}
			and exists (
				select 1
				from ${questionOptions}
				where ${questionOptions.questionId} = ${questions.id}
			)
	)
`;


export async function getQuestionBanksWithCount() {
	return db
		.select({
			id: questionBanks.id,
			slug: questionBanks.slug,
			name: questionBanks.name,
			description: questionBanks.description,
			questionCount:
				validQuestionCount
		})
		.from(questionBanks)
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
	const [bank] = await db
		.select({
			id: questionBanks.id,
			slug: questionBanks.slug,
			name: questionBanks.name,
			description:
				questionBanks.description,
			questionCount:
				validQuestionCount
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
