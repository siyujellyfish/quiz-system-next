import {
	and,
	asc,
	count,
	eq,
	ne
} from 'drizzle-orm';

import {
	db
} from '$lib/server/db';

import {
	practiceProgress,
	questionBanks,
	questions,
	userWrongQuestions
} from '$lib/server/db/schema';

export type AdminBankWriteInput = {
	name: string;
	slug: string;
	description: string | null;
};

export async function getAdminDashboardStats() {
	const [
		bankRows,
		questionRows
	] = await Promise.all([
		db
			.select({ value: count() })
			.from(questionBanks),
		db
			.select({ value: count() })
			.from(questions)
	]);

	return {
		bankCount: Number(bankRows[0]?.value ?? 0),
		questionCount:
			Number(questionRows[0]?.value ?? 0)
	};
}

export async function getAdminQuestionBanks() {
	return db
		.select({
			id: questionBanks.id,
			slug: questionBanks.slug,
			name: questionBanks.name,
			description: questionBanks.description,
			questionCount: count(questions.id)
		})
		.from(questionBanks)
		.leftJoin(
			questions,
			eq(
				questions.bankId,
				questionBanks.id
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

export async function getAdminQuestionBankById(
	bankId: string
) {
	const [bank] = await db
		.select({
			id: questionBanks.id,
			slug: questionBanks.slug,
			name: questionBanks.name,
			description: questionBanks.description
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

export async function getAdminQuestionBankWithStats(
	bankId: string
) {
	const bank =
		await getAdminQuestionBankById(
			bankId
		);

	if (!bank) {
		return null;
	}

	const [
		questionRows,
		progressRows,
		wrongRows
	] = await Promise.all([
		db
			.select({ value: count() })
			.from(questions)
			.where(
				eq(
					questions.bankId,
					bankId
				)
			),
		db
			.select({ value: count() })
			.from(practiceProgress)
			.where(
				eq(
					practiceProgress.bankId,
					bankId
				)
			),
		db
			.select({ value: count() })
			.from(userWrongQuestions)
			.innerJoin(
				questions,
				eq(
					userWrongQuestions.questionId,
					questions.id
				)
			)
			.where(
				eq(
					questions.bankId,
					bankId
				)
			)
	]);

	return {
		...bank,
		questionCount:
			Number(questionRows[0]?.value ?? 0),
		practiceProgressCount:
			Number(progressRows[0]?.value ?? 0),
		wrongQuestionCount:
			Number(wrongRows[0]?.value ?? 0)
	};
}

export async function getAdminQuestionBankBySlug(
	slug: string,
	excludeBankId?: string
) {
	const condition = excludeBankId
		? and(
			eq(questionBanks.slug, slug),
			ne(questionBanks.id, excludeBankId)
		)
		: eq(questionBanks.slug, slug);

	const [bank] = await db
		.select({
			id: questionBanks.id,
			slug: questionBanks.slug
		})
		.from(questionBanks)
		.where(condition)
		.limit(1);

	return bank ?? null;
}

export async function createAdminQuestionBank(
	input: AdminBankWriteInput
) {
	const [bank] = await db
		.insert(questionBanks)
		.values(input)
		.returning({
			id: questionBanks.id,
			slug: questionBanks.slug,
			name: questionBanks.name,
			description: questionBanks.description
		});

	return bank;
}

export async function updateAdminQuestionBank(
	bankId: string,
	input: AdminBankWriteInput
) {
	const [bank] = await db
		.update(questionBanks)
		.set(input)
		.where(
			eq(
				questionBanks.id,
				bankId
			)
		)
		.returning({
			id: questionBanks.id,
			slug: questionBanks.slug,
			name: questionBanks.name,
			description: questionBanks.description
		});

	return bank ?? null;
}

export async function deleteAdminQuestionBank(
	bankId: string
) {
	const [deleted] = await db
		.delete(questionBanks)
		.where(
			eq(
				questionBanks.id,
				bankId
			)
		)
		.returning({
			id: questionBanks.id
		});

	return deleted ?? null;
}
