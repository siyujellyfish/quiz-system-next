import { randomUUID } from 'node:crypto';

import {
	asc,
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

export type AdminBankTransferQuestion = {
	prompt: string;
	options: Array<{
		text: string;
		isCorrect: boolean;
	}>;
};

export type AdminBankTransferImportInput = {
	name: string;
	slug: string;
	description: string | null;
	questions: AdminBankTransferQuestion[];
};

function chunk<T>(
	values: T[],
	size: number
): T[][] {
	const chunks: T[][] = [];

	for (
		let index = 0;
		index < values.length;
		index += size
	) {
		chunks.push(
			values.slice(index, index + size)
		);
	}

	return chunks;
}

export async function importAdminQuestionBank(
	input: AdminBankTransferImportInput
) {
	return db.transaction(async (tx) => {
		const bankId = randomUUID();

		await tx
			.insert(questionBanks)
			.values({
				id: bankId,
				name: input.name,
				slug: input.slug,
				description: input.description
			});

		const questionRows = input.questions.map(
			(question) => ({
				id: randomUUID(),
				bankId,
				prompt: question.prompt,
				explanation: null,
				question
			})
		);

		for (const rows of chunk(questionRows, 500)) {
			await tx
				.insert(questions)
				.values(
					rows.map((row) => ({
						id: row.id,
						bankId: row.bankId,
						prompt: row.prompt,
						explanation: row.explanation
					}))
				);
		}

		const optionRows = questionRows.flatMap(
			(row) =>
				row.question.options.map(
					(option, position) => ({
						id: randomUUID(),
						questionId: row.id,
						content: option.text,
						isCorrect: option.isCorrect,
						position
					})
				)
		);

		for (const rows of chunk(optionRows, 500)) {
			await tx
				.insert(questionOptions)
				.values(rows);
		}

		return {
			bankId,
			questionCount: questionRows.length,
			optionCount: optionRows.length
		};
	});
}

export async function getAdminQuestionBankExport(
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
			eq(questionBanks.id, bankId)
		)
		.limit(1);

	if (!bank) {
		return null;
	}

	const rows = await db
		.select({
			questionId: questions.id,
			prompt: questions.prompt,
			optionId: questionOptions.id,
			optionText: questionOptions.content,
			isCorrect: questionOptions.isCorrect,
			position: questionOptions.position
		})
		.from(questions)
		.leftJoin(
			questionOptions,
			eq(
				questionOptions.questionId,
				questions.id
			)
		)
		.where(
			eq(questions.bankId, bankId)
		)
		.orderBy(
			asc(questions.prompt),
			asc(questionOptions.position)
		);

	const exportedQuestions: Array<{
		id: string;
		prompt: string;
		options: Array<{
			id: string;
			text: string;
			isCorrect: boolean;
		}>;
	}> = [];
	const byQuestionId = new Map<
		string,
		(typeof exportedQuestions)[number]
	>();

	for (const row of rows) {
		let question = byQuestionId.get(
			row.questionId
		);

		if (!question) {
			question = {
				id: row.questionId,
				prompt: row.prompt,
				options: []
			};
			byQuestionId.set(
				row.questionId,
				question
			);
			exportedQuestions.push(question);
		}

		if (
			row.optionId !== null &&
			row.optionText !== null &&
			row.isCorrect !== null
		) {
			question.options.push({
				id: row.optionId,
				text: row.optionText,
				isCorrect: row.isCorrect
			});
		}
	}

	return {
		bank,
		questions: exportedQuestions
	};
}
