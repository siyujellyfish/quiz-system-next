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
	explanation: string | null;
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

type ExistingQuestion = {
	id: string;
	prompt: string;
	explanation: string | null;
	options: Array<{
		id: string;
		text: string;
		isCorrect: boolean;
		position: number;
	}>;
};

function chunk<T>(values: T[], size: number): T[][] {
	const chunks: T[][] = [];

	for (let index = 0; index < values.length; index += size) {
		chunks.push(values.slice(index, index + size));
	}

	return chunks;
}

function getQuestionSignature(
	question: Pick<AdminBankTransferQuestion, 'prompt' | 'options'>
) {
	return JSON.stringify([
		question.prompt,
		question.options.map((option) => option.text)
	]);
}

function getExistingQuestionSignature(question: ExistingQuestion) {
	return JSON.stringify([
		question.prompt,
		question.options.map((option) => option.text)
	]);
}

export async function importAdminQuestionBank(
	input: AdminBankTransferImportInput
) {
	return db.transaction(async (tx) => {
		const [existingBank] = await tx
			.select({ id: questionBanks.id })
			.from(questionBanks)
			.where(eq(questionBanks.slug, input.slug))
			.limit(1);

		const created = !existingBank;
		const bankId = existingBank?.id ?? randomUUID();

		if (created) {
			await tx.insert(questionBanks).values({
				id: bankId,
				name: input.name,
				slug: input.slug,
				description: input.description
			});
		} else {
			await tx
				.update(questionBanks)
				.set({
					name: input.name,
					description: input.description
				})
				.where(eq(questionBanks.id, bankId));
		}

		const existingRows = await tx
			.select({
				questionId: questions.id,
				prompt: questions.prompt,
				explanation: questions.explanation,
				optionId: questionOptions.id,
				optionText: questionOptions.content,
				isCorrect: questionOptions.isCorrect,
				position: questionOptions.position
			})
			.from(questions)
			.leftJoin(
				questionOptions,
				eq(questionOptions.questionId, questions.id)
			)
			.where(eq(questions.bankId, bankId))
			.orderBy(
				asc(questions.id),
				asc(questionOptions.position)
			);

		const existingQuestions: ExistingQuestion[] = [];
		const existingById = new Map<string, ExistingQuestion>();

		for (const row of existingRows) {
			let question = existingById.get(row.questionId);

			if (!question) {
				question = {
					id: row.questionId,
					prompt: row.prompt,
					explanation: row.explanation,
					options: []
				};
				existingById.set(row.questionId, question);
				existingQuestions.push(question);
			}

			if (
				row.optionId !== null &&
				row.optionText !== null &&
				row.isCorrect !== null &&
				row.position !== null
			) {
				question.options.push({
					id: row.optionId,
					text: row.optionText,
					isCorrect: row.isCorrect,
					position: row.position
				});
			}
		}

		const existingBySignature = new Map<
			string,
			ExistingQuestion[]
		>();

		for (const question of existingQuestions) {
			const signature = getExistingQuestionSignature(question);
			const values = existingBySignature.get(signature) ?? [];
			values.push(question);
			existingBySignature.set(signature, values);
		}

		let matchedQuestionCount = 0;
		let updatedExplanationCount = 0;
		let updatedCorrectAnswerCount = 0;
		const newQuestionRows: Array<{
			id: string;
			bankId: string;
			prompt: string;
			explanation: string | null;
			question: AdminBankTransferQuestion;
		}> = [];

		for (const sourceQuestion of input.questions) {
			const signature = getQuestionSignature(sourceQuestion);
			const candidates = existingBySignature.get(signature);
			const existingQuestion = candidates?.shift();

			if (!existingQuestion) {
				newQuestionRows.push({
					id: randomUUID(),
					bankId,
					prompt: sourceQuestion.prompt,
					explanation: sourceQuestion.explanation,
					question: sourceQuestion
				});
				continue;
			}

			matchedQuestionCount += 1;

			if (
				existingQuestion.explanation !== sourceQuestion.explanation
			) {
				await tx
					.update(questions)
					.set({ explanation: sourceQuestion.explanation })
					.where(eq(questions.id, existingQuestion.id));
				updatedExplanationCount += 1;
			}

			for (
				let optionIndex = 0;
				optionIndex < sourceQuestion.options.length;
				optionIndex += 1
			) {
				const sourceOption = sourceQuestion.options[optionIndex];
				const existingOption = existingQuestion.options[optionIndex];

				if (
					sourceOption &&
					existingOption &&
					sourceOption.isCorrect !== existingOption.isCorrect
				) {
					await tx
						.update(questionOptions)
						.set({ isCorrect: sourceOption.isCorrect })
						.where(eq(questionOptions.id, existingOption.id));
					updatedCorrectAnswerCount += 1;
				}
			}
		}

		for (const rows of chunk(newQuestionRows, 500)) {
			await tx.insert(questions).values(
				rows.map((row) => ({
					id: row.id,
					bankId: row.bankId,
					prompt: row.prompt,
					explanation: row.explanation
				}))
			);
		}

		const newOptionRows = newQuestionRows.flatMap((row) =>
			row.question.options.map((option, position) => ({
				id: randomUUID(),
				questionId: row.id,
				content: option.text,
				isCorrect: option.isCorrect,
				position
			}))
		);

		for (const rows of chunk(newOptionRows, 500)) {
			await tx.insert(questionOptions).values(rows);
		}

		return {
			bankId,
			mode: created ? ('created' as const) : ('synced' as const),
			questionCount: input.questions.length,
			matchedQuestionCount,
			insertedQuestionCount: newQuestionRows.length,
			updatedExplanationCount,
			updatedCorrectAnswerCount,
			optionCount: input.questions.reduce(
				(total, question) => total + question.options.length,
				0
			)
		};
	});
}

export async function getAdminQuestionBankExport(bankId: string) {
	const [bank] = await db
		.select({
			id: questionBanks.id,
			slug: questionBanks.slug,
			name: questionBanks.name,
			description: questionBanks.description
		})
		.from(questionBanks)
		.where(eq(questionBanks.id, bankId))
		.limit(1);

	if (!bank) {
		return null;
	}

	const rows = await db
		.select({
			questionId: questions.id,
			prompt: questions.prompt,
			explanation: questions.explanation,
			optionId: questionOptions.id,
			optionText: questionOptions.content,
			isCorrect: questionOptions.isCorrect,
			position: questionOptions.position
		})
		.from(questions)
		.leftJoin(
			questionOptions,
			eq(questionOptions.questionId, questions.id)
		)
		.where(eq(questions.bankId, bankId))
		.orderBy(
			asc(questions.id),
			asc(questionOptions.position)
		);

	const exportedQuestions: Array<{
		id: string;
		prompt: string;
		explanation: string | null;
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
		let question = byQuestionId.get(row.questionId);

		if (!question) {
			question = {
				id: row.questionId,
				prompt: row.prompt,
				explanation: row.explanation,
				options: []
			};
			byQuestionId.set(row.questionId, question);
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
		version: 1 as const,
		bank: {
			name: bank.name,
			slug: bank.slug,
			description: bank.description
		},
		questions: exportedQuestions
	};
}
