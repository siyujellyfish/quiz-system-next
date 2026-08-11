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
	clearExamHistoryForUser,
	deleteExamHistoryForUser,
	getExamHistoryForUser
} from '$lib/server/quiz/exam-attempt.repository';
import {
	startUserExamAttempt,
	submitUserExamAttempt
} from '$lib/server/quiz/exam-attempt.service';

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

async function seedExamFixture(input: {
	userId: string;
	username: string;
	bankId: string;
	bankSlug: string;
	bankName: string;
	questionId: string;
	correctOptionId: string;
	wrongOptionId: string;
}): Promise<void> {
	await sql`
		INSERT INTO users (id, username, password_hash)
		VALUES (${input.userId}, ${input.username}, 'hash')
	`;

	await sql`
		INSERT INTO question_banks (id, slug, name)
		VALUES (${input.bankId}, ${input.bankSlug}, ${input.bankName})
	`;

	await sql`
		INSERT INTO questions (id, bank_id, prompt)
		VALUES (${input.questionId}, ${input.bankId}, 'Exam question')
	`;

	await sql`
		INSERT INTO question_options (
			id,
			question_id,
			content,
			is_correct,
			position
		)
		VALUES
			(${input.correctOptionId}, ${input.questionId}, 'Correct', true, 0),
			(${input.wrongOptionId}, ${input.questionId}, 'Wrong', false, 1)
	`;
}

beforeEach(async () => {
	await resetDatabase();
});

afterAll(async () => {
	await resetDatabase();
	await sql.end();
});

describe('exam history', () => {
	it('uses the server attempt start time and keeps duplicate submit idempotent', async () => {
		const userId = randomUUID();
		const bankId = randomUUID();
		const questionId = randomUUID();
		const correctOptionId = randomUUID();
		const wrongOptionId = randomUUID();

		await seedExamFixture({
			userId,
			username: 'history-user',
			bankId,
			bankSlug: 'history-bank',
			bankName: 'History Bank',
			questionId,
			correctOptionId,
			wrongOptionId
		});

		const attempt = await startUserExamAttempt({
			userId,
			bankId,
			bankName: 'History Bank',
			totalQuestions: 1
		});

		await sql`
			UPDATE exam_attempts
			SET started_at = now() - interval '65 seconds'
			WHERE id = ${attempt.id}
		`;

		const firstResult = await submitUserExamAttempt({
			userId,
			bankId,
			answers: {
				[questionId]: correctOptionId
			}
		});

		expect(firstResult.correctCount).toBe(1);
		expect(firstResult.elapsedSeconds).toBeGreaterThanOrEqual(64);

		const repeatedResult = await submitUserExamAttempt({
			userId,
			bankId,
			answers: {
				[questionId]: wrongOptionId
			}
		});

		expect(repeatedResult.correctCount).toBe(1);
		expect(repeatedResult.elapsedSeconds).toBe(
			firstResult.elapsedSeconds
		);

		const history = await getExamHistoryForUser(userId);

		expect(history).toHaveLength(1);
		expect(history[0]?.correctCount).toBe(1);
		expect(history[0]?.bankName).toBe('History Bank');
	});

	it('keeps submitted history readable after its question bank is deleted', async () => {
		const userId = randomUUID();
		const bankId = randomUUID();
		const questionId = randomUUID();
		const correctOptionId = randomUUID();
		const wrongOptionId = randomUUID();

		await seedExamFixture({
			userId,
			username: 'deleted-bank-user',
			bankId,
			bankSlug: 'deleted-bank',
			bankName: 'Deleted Bank',
			questionId,
			correctOptionId,
			wrongOptionId
		});

		await startUserExamAttempt({
			userId,
			bankId,
			bankName: 'Deleted Bank',
			totalQuestions: 1
		});
		await submitUserExamAttempt({
			userId,
			bankId,
			answers: {
				[questionId]: correctOptionId
			}
		});

		await sql`
			DELETE FROM question_banks
			WHERE id = ${bankId}
		`;

		const history = await getExamHistoryForUser(userId);

		expect(history).toHaveLength(1);
		expect(history[0]?.bankId).toBeNull();
		expect(history[0]?.bankName).toBe('Deleted Bank');
	});

	it('limits delete and clear operations to the owning user and submitted history', async () => {
		const firstUserId = randomUUID();
		const secondUserId = randomUUID();
		const bankId = randomUUID();
		const questionId = randomUUID();
		const correctOptionId = randomUUID();
		const wrongOptionId = randomUUID();

		await seedExamFixture({
			userId: firstUserId,
			username: 'history-owner',
			bankId,
			bankSlug: 'owner-bank',
			bankName: 'Owner Bank',
			questionId,
			correctOptionId,
			wrongOptionId
		});

		await sql`
			INSERT INTO users (id, username, password_hash)
			VALUES (${secondUserId}, 'history-other', 'hash')
		`;

		await startUserExamAttempt({
			userId: firstUserId,
			bankId,
			bankName: 'Owner Bank',
			totalQuestions: 1
		});
		await submitUserExamAttempt({
			userId: firstUserId,
			bankId,
			answers: {
				[questionId]: correctOptionId
			}
		});

		await startUserExamAttempt({
			userId: secondUserId,
			bankId,
			bankName: 'Owner Bank',
			totalQuestions: 1
		});
		await submitUserExamAttempt({
			userId: secondUserId,
			bankId,
			answers: {
				[questionId]: wrongOptionId
			}
		});

		const secondHistory =
			await getExamHistoryForUser(secondUserId);
		const secondAttemptId =
			secondHistory[0]?.id;

		expect(secondAttemptId).toBeTruthy();

		const crossUserDeleted =
			await deleteExamHistoryForUser(
				secondAttemptId!,
				firstUserId
			);

		expect(crossUserDeleted).toBe(false);

		await startUserExamAttempt({
			userId: firstUserId,
			bankId,
			bankName: 'Owner Bank',
			totalQuestions: 1
		});

		const clearedCount =
			await clearExamHistoryForUser(
				firstUserId
			);

		expect(clearedCount).toBe(1);
		expect(
			await getExamHistoryForUser(firstUserId)
		).toHaveLength(0);
		expect(
			await getExamHistoryForUser(secondUserId)
		).toHaveLength(1);

		const [activeCount] = await sql<{
			count: number;
		}[]>`
			SELECT count(*)::int AS count
			FROM exam_attempts
			WHERE user_id = ${firstUserId}
				AND submitted_at IS NULL
		`;

		expect(activeCount?.count).toBe(1);
	});
});
