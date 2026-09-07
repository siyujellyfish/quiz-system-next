import {
	and,
	asc,
	count,
	eq,
	sql
} from 'drizzle-orm';

import {
	db
} from '$lib/server/db';

import {
	questionOptions,
	questions
} from '$lib/server/db/schema';

import {
	getAdminQuestionEditor
} from '$lib/server/admin/question.repository';

export type AdminQuestionHealthFilter =
	| 'all'
	| 'healthy'
	| 'invalid';

export type AdminQuestionWorkspaceInput = {
	bankId: string;
	query: string;
	health: AdminQuestionHealthFilter;
	questionId: string | null;
};

function getWorkspaceWhere(
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
			or exists (
				select 1
				from ${questionOptions} as search_option
				where search_option.question_id = ${questions.id}
					and search_option.content ilike ${pattern}
			)
		)`
	);
}

function getWorkspaceHealthHaving(
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

export async function getAdminQuestionWorkspace(
	input: AdminQuestionWorkspaceInput
) {
	const rows = await db
		.select({
			id: questions.id,
			prompt: questions.prompt,
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
		.where(
			getWorkspaceWhere(
				input.bankId,
				input.query
			)
		)
		.groupBy(
			questions.id,
			questions.prompt
		)
		.having(
			getWorkspaceHealthHaving(
				input.health
			)
		)
		.orderBy(
			asc(questions.prompt),
			asc(questions.id)
		);

	const items = rows.map(
		(row) => ({
			...row,
			optionCount:
				Number(row.optionCount),
			correctOptionCount:
				Number(row.correctOptionCount)
		})
	);

	if (items.length === 0) {
		return {
			items,
			currentQuestion: null,
			currentSummary: null,
			position: 0,
			total: 0,
			previousQuestionId: null,
			nextQuestionId: null
		};
	}

	const requestedIndex =
		input.questionId
			? items.findIndex(
				(item) =>
					item.id === input.questionId
			)
			: -1;
	const currentIndex =
		requestedIndex >= 0
			? requestedIndex
			: 0;
	const currentSummary =
		items[currentIndex] ?? null;
	const currentQuestion =
		currentSummary
			? await getAdminQuestionEditor(
				input.bankId,
				currentSummary.id
			)
			: null;

	return {
		items,
		currentQuestion,
		currentSummary,
		position: currentIndex + 1,
		total: items.length,
		previousQuestionId:
			items[currentIndex - 1]?.id ?? null,
		nextQuestionId:
			items[currentIndex + 1]?.id ?? null
	};
}
