import {
	and,
	count,
	desc,
	eq,
	isNotNull,
	sql
} from 'drizzle-orm';

import {
	db
} from '$lib/server/db';

import {
	examAttempts
} from '$lib/server/db/schema';

export type ExamAnalyticsOverview = {
	attemptCount: number;
	averageAccuracy: number;
	bestAccuracy: number;
	averageDurationSeconds: number;
};

export type ExamAnalyticsTrendPoint = {
	id: string;
	bankName: string;
	submittedAt: Date;
	accuracy: number;
};

export type ExamAnalyticsBankSummary = {
	bankId: string | null;
	bankName: string;
	attemptCount: number;
	averageAccuracy: number;
	bestAccuracy: number;
	averageDurationSeconds: number;
	lastAttemptAt: Date;
};

export type ExamLearningAnalytics = {
	overview: ExamAnalyticsOverview;
	recentTrend: ExamAnalyticsTrendPoint[];
	banks: ExamAnalyticsBankSummary[];
};

const accuracyExpression = sql<number>`
	case
		when ${examAttempts.totalQuestions} > 0 then
			coalesce(${examAttempts.correctCount}, 0)::float8 /
			${examAttempts.totalQuestions}::float8 * 100
		else 0
	end
`;

function normalizeDatabaseDate(
	value: unknown,
	field: string
): Date {
	if (value instanceof Date) {
		if (!Number.isNaN(value.getTime())) {
			return value;
		}
	}

	if (
		typeof value === 'string' ||
		typeof value === 'number'
	) {
		const parsed = new Date(value);

		if (!Number.isNaN(parsed.getTime())) {
			return parsed;
		}
	}

	throw new Error(
		`Invalid ${field} returned by database`
	);
}

export async function getExamLearningAnalyticsForUser(
	userId: string
): Promise<ExamLearningAnalytics> {
	const submittedFilter = and(
		eq(
			examAttempts.userId,
			userId
		),
		isNotNull(
			examAttempts.submittedAt
		)
	);

	const [
		overviewRows,
		recentRows,
		bankRows
	] = await Promise.all([
		db
			.select({
				attemptCount:
					count(examAttempts.id),
				averageAccuracy: sql<number>`
					coalesce(avg(${accuracyExpression}), 0)::float8
				`,
				bestAccuracy: sql<number>`
					coalesce(max(${accuracyExpression}), 0)::float8
				`,
				averageDurationSeconds: sql<number>`
					coalesce(avg(coalesce(${examAttempts.elapsedSeconds}, 0)), 0)::float8
				`
			})
			.from(examAttempts)
			.where(submittedFilter),

		db
			.select({
				id: examAttempts.id,
				bankName: examAttempts.bankName,
				submittedAt: examAttempts.submittedAt,
				accuracy: accuracyExpression
			})
			.from(examAttempts)
			.where(submittedFilter)
			.orderBy(
				desc(examAttempts.submittedAt)
			)
			.limit(10),

		db
			.select({
				bankId: examAttempts.bankId,
				bankName: examAttempts.bankName,
				attemptCount:
					count(examAttempts.id),
				averageAccuracy: sql<number>`
					coalesce(avg(${accuracyExpression}), 0)::float8
				`,
				bestAccuracy: sql<number>`
					coalesce(max(${accuracyExpression}), 0)::float8
				`,
				averageDurationSeconds: sql<number>`
					coalesce(avg(coalesce(${examAttempts.elapsedSeconds}, 0)), 0)::float8
				`,
				lastAttemptAt: sql<Date>`
					max(${examAttempts.submittedAt})
				`
			})
			.from(examAttempts)
			.where(submittedFilter)
			.groupBy(
				examAttempts.bankId,
				examAttempts.bankName
			)
			.orderBy(
				desc(count(examAttempts.id)),
				examAttempts.bankName
			)
	]);

	const overview = overviewRows[0] ?? {
		attemptCount: 0,
		averageAccuracy: 0,
		bestAccuracy: 0,
		averageDurationSeconds: 0
	};

	return {
		overview,
		recentTrend: recentRows
			.filter(
				(row) =>
					row.submittedAt !== null
			)
			.map((row) => ({
				id: row.id,
				bankName: row.bankName,
				submittedAt: normalizeDatabaseDate(
					row.submittedAt,
					'submittedAt'
				),
				accuracy: row.accuracy
			}))
			.reverse(),
		banks: bankRows.map((row) => ({
			...row,
			lastAttemptAt: normalizeDatabaseDate(
				row.lastAttemptAt,
				'lastAttemptAt'
			)
		}))
	};
}
