import {
	randomUUID
} from 'node:crypto';

import postgres from 'postgres';
import {
	afterAll,
	beforeEach,
	describe,
	expect,
	it
} from 'vitest';

import {
	getExamLearningAnalyticsForUser
} from '$lib/server/quiz/exam-analytics.repository';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error(
		'DATABASE_URL is required for PostgreSQL integration tests'
	);
}

const sql = postgres(databaseUrl, {
	max: 1
});

async function resetDatabase(): Promise<void> {
	await sql.unsafe(`
		TRUNCATE TABLE
			exam_attempts,
			user_wrong_questions,
			practice_progress,
			user_sessions,
			question_options,
			questions,
			question_banks,
			users
		RESTART IDENTITY CASCADE
	`);
}

beforeEach(async () => {
	await resetDatabase();
});

afterAll(async () => {
	await resetDatabase();
	await sql.end();
});

async function insertSubmittedAttempt(input: {
	userId: string;
	bankId: string | null;
	bankName: string;
	correctCount: number;
	totalQuestions: number;
	elapsedSeconds: number;
	submittedAt: Date;
}) {
	await sql`
		INSERT INTO exam_attempts (
			user_id,
			bank_id,
			bank_name,
			started_at,
			submitted_at,
			total_questions,
			answered_count,
			correct_count,
			incorrect_count,
			elapsed_seconds,
			answers
		)
		VALUES (
			${input.userId},
			${input.bankId},
			${input.bankName},
			${new Date(input.submittedAt.getTime() - input.elapsedSeconds * 1000)},
			${input.submittedAt},
			${input.totalQuestions},
			${input.totalQuestions},
			${input.correctCount},
			${input.totalQuestions - input.correctCount},
			${input.elapsedSeconds},
			${sql.json({})}
		)
	`;
}

describe('exam learning analytics', () => {
	it('aggregates only the current user submitted attempts', async () => {
		const userId = randomUUID();
		const otherUserId = randomUUID();
		const bankAId = randomUUID();
		const bankBId = randomUUID();

		await sql`
			INSERT INTO users (id, username, password_hash)
			VALUES
				(${userId}, 'analytics-user', 'hash'),
				(${otherUserId}, 'analytics-other', 'hash')
		`;

		await sql`
			INSERT INTO question_banks (id, slug, name)
			VALUES
				(${bankAId}, 'analytics-a', 'Bank A'),
				(${bankBId}, 'analytics-b', 'Bank B')
		`;

		await insertSubmittedAttempt({
			userId,
			bankId: bankAId,
			bankName: 'Bank A',
			correctCount: 8,
			totalQuestions: 10,
			elapsedSeconds: 60,
			submittedAt: new Date('2026-08-01T08:00:00Z')
		});
		await insertSubmittedAttempt({
			userId,
			bankId: bankAId,
			bankName: 'Bank A',
			correctCount: 10,
			totalQuestions: 10,
			elapsedSeconds: 120,
			submittedAt: new Date('2026-08-02T08:00:00Z')
		});
		await insertSubmittedAttempt({
			userId,
			bankId: bankBId,
			bankName: 'Bank B',
			correctCount: 1,
			totalQuestions: 2,
			elapsedSeconds: 180,
			submittedAt: new Date('2026-08-03T08:00:00Z')
		});
		await insertSubmittedAttempt({
			userId,
			bankId: null,
			bankName: 'Legacy Bank',
			correctCount: 3,
			totalQuestions: 4,
			elapsedSeconds: 240,
			submittedAt: new Date('2026-08-04T08:00:00Z')
		});

		await sql`
			INSERT INTO exam_attempts (
				user_id,
				bank_id,
				bank_name,
				total_questions
			)
			VALUES (
				${userId},
				${bankBId},
				'Bank B',
				10
			)
		`;

		await insertSubmittedAttempt({
			userId: otherUserId,
			bankId: bankAId,
			bankName: 'Bank A',
			correctCount: 10,
			totalQuestions: 10,
			elapsedSeconds: 30,
			submittedAt: new Date('2026-08-05T08:00:00Z')
		});

		const analytics =
			await getExamLearningAnalyticsForUser(
				userId
			);

		expect(analytics.overview.attemptCount).toBe(4);
		expect(analytics.overview.averageAccuracy).toBeCloseTo(76.25);
		expect(analytics.overview.bestAccuracy).toBeCloseTo(100);
		expect(
			analytics.overview.averageDurationSeconds
		).toBeCloseTo(150);

		expect(
			analytics.recentTrend.map(
				(point) => point.bankName
			)
		).toEqual([
			'Bank A',
			'Bank A',
			'Bank B',
			'Legacy Bank'
		]);
		expect(
			analytics.recentTrend.map(
				(point) => point.accuracy
			)
		).toEqual([
			80,
			100,
			50,
			75
		]);

		expect(analytics.banks).toHaveLength(3);
		expect(analytics.banks[0]).toMatchObject({
		bankId: bankAId,
		bankName: 'Bank A',
		attemptCount: 2,
		averageAccuracy: 90,
		bestAccuracy: 100,
		averageDurationSeconds: 90
	});
		expect(analytics.banks[1]).toMatchObject({
		bankId: bankBId,
		bankName: 'Bank B',
		attemptCount: 1,
		averageAccuracy: 50,
		bestAccuracy: 50,
		averageDurationSeconds: 180
	});
		expect(analytics.banks[2]).toMatchObject({
		bankId: null,
		bankName: 'Legacy Bank',
		attemptCount: 1,
		averageAccuracy: 75,
		bestAccuracy: 75,
		averageDurationSeconds: 240
	});
	});

	it('limits the recent trend to the latest ten attempts', async () => {
		const userId = randomUUID();
		const bankId = randomUUID();

		await sql`
			INSERT INTO users (id, username, password_hash)
			VALUES (${userId}, 'trend-user', 'hash')
		`;

		await sql`
			INSERT INTO question_banks (id, slug, name)
			VALUES (${bankId}, 'trend-bank', 'Trend Bank')
		`;

		for (let index = 1; index <= 12; index += 1) {
			await insertSubmittedAttempt({
				userId,
				bankId,
				bankName: 'Trend Bank',
				correctCount: index % 11,
				totalQuestions: 10,
				elapsedSeconds: 60 + index,
				submittedAt: new Date(
					`2026-07-${String(index).padStart(2, '0')}T08:00:00Z`
				)
			});
		}

		const analytics =
			await getExamLearningAnalyticsForUser(
				userId
			);

		expect(analytics.overview.attemptCount).toBe(12);
		expect(analytics.recentTrend).toHaveLength(10);
		expect(
			analytics.recentTrend[0]?.submittedAt.toISOString()
		).toBe('2026-07-03T08:00:00.000Z');
		expect(
			analytics.recentTrend[9]?.submittedAt.toISOString()
		).toBe('2026-07-12T08:00:00.000Z');
	});
});
