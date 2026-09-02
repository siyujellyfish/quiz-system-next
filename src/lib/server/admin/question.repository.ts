import {
	and,
	asc,
	count,
	eq,
	inArray,
	sql
} from 'drizzle-orm';

import {
	db
} from '$lib/server/db';

import {
	practiceProgress,
	questionOptions,
	questions
} from '$lib/server/db/schema';

export type AdminQuestionOptionWriteInput = {
	id: string | null;
	content: string;
	isCorrect: boolean;
	position: number;
};

export type AdminQuestionWriteInput = {
	prompt: string;
	explanation: string | null;
	options: AdminQuestionOptionWriteInput[];
};

export type AdminQuestionHealthFilter =
	| 'all'
	| 'healthy'
	| 'invalid';

export type AdminQuestionListInput = {
	bankId: string;
	query: string;
	health: AdminQuestionHealthFilter;
	page: number;
	pageSize: number;
};

function getAdminQuestionListWhere(
	bankId: string,
	query: string
) {
	const normalizedQuery = query.trim();

	if (!normalizedQuery) {
		return eq(
			questions.bankId,
			bankId
		);
	}

	const pattern = `%${normalizedQuery}%`;

	return and(
		eq(
			questions.bankId,
			bankId
		),
		sql<boolean>`(
			${questions.prompt} ilike ${pattern}
			or ${questions.explanation} ilike ${pattern}
			or ${questions.id}::text ilike ${pattern}
		)`
	);
}

function getAdminQuestionHealthHaving(
	health: AdminQuestionHealthFilter
) {
	const optionCount =
		sql<number>`count(${questionOptions.id})`;
	const correctOptionCount =
		sql<number>`count(*) filter (where ${questionOptions.isCorrect} = true)`;

	switch (health) {
		case 'healthy':
			return sql<boolean>`
				${optionCount} >= 2
				and ${correctOptionCount} = 1
			`;

		case 'invalid':
			return sql<boolean>`
				${optionCount} < 2
				or ${correctOptionCount} <> 1
			`;

		default:
			return sql<boolean>`true`;
	}
}

export async function getAdminQuestionList(
	input: AdminQuestionListInput
) {
	const whereCondition =
		getAdminQuestionListWhere(
			input.bankId,
			input.query
		);
	const healthHaving =
		getAdminQuestionHealthHaving(
			input.health
		);

	const filteredQuestions = db
		.select({
			id: questions.id
		})
		.from(questions)
		.leftJoin(
			questionOptions,
			eq(
				questionOptions.questionId,
				questions.id
			)
		)
		.where(whereCondition)
		.groupBy(questions.id)
		.having(healthHaving)
		.as('filtered_admin_questions');

	const [countRow] = await db
		.select({
			total: count()
		})
		.from(filteredQuestions);

	const total = Number(
		countRow?.total ?? 0
	);
	const totalPages = Math.max(
		1,
		Math.ceil(total / input.pageSize)
	);
	const page = Math.min(
		Math.max(1, input.page),
		totalPages
	);

	const rows = await db
		.select({
			id: questions.id,
			prompt: questions.prompt,
			explanation: questions.explanation,
			optionCount: count(questionOptions.id),
			correctOptionCount:
				sql<number>`count(*) filter (where ${questionOptions.isCorrect} = true)`
		})
		.from(questions)
		.leftJoin(
			questionOptions,
			eq(
				questionOptions.questionId,
				questions.id
			)
		)
		.where(whereCondition)
		.groupBy(
			questions.id,
			questions.prompt,
			questions.explanation
		)
		.having(healthHaving)
		.orderBy(
			asc(questions.prompt),
			asc(questions.id)
		)
		.limit(input.pageSize)
		.offset(
			(page - 1) * input.pageSize
		);

	return {
		questions: rows.map(
			(question) => ({
				...question,
				optionCount:
					Number(question.optionCount),
				correctOptionCount:
					Number(question.correctOptionCount)
			})
		),
		total,
		page,
		totalPages,
		pageSize: input.pageSize
	};
}

export async function getAdminQuestions(
	bankId: string
) {
	return db
		.select({
			id: questions.id,
			prompt: questions.prompt,
			explanation: questions.explanation,
			optionCount: count(questionOptions.id),
			correctOptionCount: sql<number>`count(*) filter (where ${questionOptions.isCorrect} = true)`
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
			eq(
				questions.bankId,
				bankId
			)
		)
		.groupBy(
			questions.id,
			questions.prompt,
			questions.explanation
		)
		.orderBy(
			asc(questions.prompt)
		);
}

export async function getAdminQuestionEditor(
	bankId: string,
	questionId: string
) {
	const [question] = await db
		.select({
			id: questions.id,
			bankId: questions.bankId,
			prompt: questions.prompt,
			explanation: questions.explanation
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

	if (!question) {
		return null;
	}

	const options = await db
		.select({
			id: questionOptions.id,
			content: questionOptions.content,
			isCorrect: questionOptions.isCorrect,
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
			asc(questionOptions.position)
		);

	return {
		...question,
		options
	};
}

export async function createAdminQuestion(
	bankId: string,
	input: AdminQuestionWriteInput
) {
	return db.transaction(async (tx) => {
		const [question] = await tx
			.insert(questions)
			.values({
				bankId,
				prompt: input.prompt,
				explanation: input.explanation
			})
			.returning({
				id: questions.id,
				bankId: questions.bankId,
				prompt: questions.prompt,
				explanation: questions.explanation
			});

		if (!question) {
			throw new Error(
				'Failed to create question'
			);
		}

		await tx
			.insert(questionOptions)
			.values(
				input.options.map(
					(option) => ({
						questionId: question.id,
						content: option.content,
						isCorrect: option.isCorrect,
						position: option.position
					})
				)
			);

		return question;
	});
}

export async function updateAdminQuestion(
	bankId: string,
	questionId: string,
	input: AdminQuestionWriteInput
) {
	return db.transaction(async (tx) => {
		const existingOptions = await tx
			.select({
				id: questionOptions.id
			})
			.from(questionOptions)
			.where(
				eq(
					questionOptions.questionId,
					questionId
				)
			);

		const existingIds = new Set(
			existingOptions.map(
				(option) => option.id
			)
		);

		const submittedExistingIds =
			input.options
				.map((option) => option.id)
				.filter(
					(id): id is string =>
						id !== null
				);

		const membershipChanged =
			submittedExistingIds.length !==
				existingIds.size ||
			input.options.some(
				(option) => option.id === null
			);

		const [updatedQuestion] = await tx
			.update(questions)
			.set({
				prompt: input.prompt,
				explanation: input.explanation
			})
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
			.returning({
				id: questions.id,
				bankId: questions.bankId,
				prompt: questions.prompt,
				explanation: questions.explanation
			});

		if (!updatedQuestion) {
			return null;
		}

		const removedIds =
			[...existingIds].filter(
				(id) =>
					!submittedExistingIds.includes(id)
			);

		if (removedIds.length > 0) {
			await tx
				.delete(questionOptions)
				.where(
					inArray(
						questionOptions.id,
						removedIds
					)
				);
		}

		const retainedOptions =
			input.options.filter(
				(option): option is AdminQuestionOptionWriteInput & { id: string } =>
					option.id !== null
			);

		for (
			let index = 0;
			index < retainedOptions.length;
			index += 1
		) {
			const option = retainedOptions[index];

			await tx
				.update(questionOptions)
				.set({
					position: 1000 + index
				})
				.where(
					and(
						eq(
							questionOptions.id,
							option.id
						),
						eq(
							questionOptions.questionId,
							questionId
						)
					)
				);
		}

		const newOptions = input.options.filter(
			(option) => option.id === null
		);

		if (newOptions.length > 0) {
			await tx
				.insert(questionOptions)
				.values(
					newOptions.map(
						(option) => ({
							questionId,
							content: option.content,
							isCorrect: option.isCorrect,
							position: option.position
						})
					)
				);
		}

		for (const option of retainedOptions) {
			await tx
				.update(questionOptions)
				.set({
					content: option.content,
					isCorrect: option.isCorrect,
					position: option.position
				})
				.where(
					and(
						eq(
							questionOptions.id,
							option.id
						),
						eq(
							questionOptions.questionId,
							questionId
						)
					)
				);
		}

		if (membershipChanged) {
			await tx
				.delete(practiceProgress)
				.where(
					eq(
					practiceProgress.bankId,
					bankId
				)
				);
		}

		return {
			question: updatedQuestion,
			practiceProgressReset:
				membershipChanged
		};
	});
}

export async function deleteAdminQuestion(
	bankId: string,
	questionId: string
) {
	return db.transaction(async (tx) => {
		const [deleted] = await tx
			.delete(questions)
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
			.returning({
				id: questions.id
			});

		if (!deleted) {
			return null;
		}

		await tx
			.delete(practiceProgress)
			.where(
				eq(
				practiceProgress.bankId,
				bankId
			)
		);

		return deleted;
	});
}
