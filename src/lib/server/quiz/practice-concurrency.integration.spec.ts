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
	answerUserPracticeQuestion,
	PracticeAnswerError
} from '$lib/server/quiz/answer.service';

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

describe('practice answer concurrency', () => {
	it('advances only once when the same question is submitted concurrently', async () => {
		const userId = randomUUID();
		const bankId = randomUUID();
		const firstQuestionId = randomUUID();
		const secondQuestionId = randomUUID();
		const firstCorrectOptionId = randomUUID();
		const firstWrongOptionId = randomUUID();
		const secondCorrectOptionId = randomUUID();
		const secondWrongOptionId = randomUUID();

		await sql`
			INSERT INTO users (id, username, password_hash)
			VALUES (${userId}, 'concurrency-user', 'hash')
		`;

		await sql`
			INSERT INTO question_banks (id, slug, name)
			VALUES (${bankId}, 'concurrency-bank', 'Concurrency Bank')
		`;

		await sql`
			INSERT INTO questions (id, bank_id, prompt)
			VALUES
				(${firstQuestionId}, ${bankId}, 'First question'),
				(${secondQuestionId}, ${bankId}, 'Second question')
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
				(${firstCorrectOptionId}, ${firstQuestionId}, 'First correct', true, 0),
				(${firstWrongOptionId}, ${firstQuestionId}, 'First wrong', false, 1),
				(${secondCorrectOptionId}, ${secondQuestionId}, 'Second correct', true, 0),
				(${secondWrongOptionId}, ${secondQuestionId}, 'Second wrong', false, 1)
		`;

		await sql`
			INSERT INTO practice_progress (
				user_id,
				bank_id,
				questions_state,
				current_index,
				answered_count,
				correct_count
			)
			VALUES (
				${userId},
				${bankId},
				${sql.json({
					version: 1,
					coverage: 100,
					shuffleOptions: false,
					questions: [
						{
							questionId: firstQuestionId,
							optionIds: [
								firstCorrectOptionId,
								firstWrongOptionId
							]
						},
						{
							questionId: secondQuestionId,
							optionIds: [
								secondCorrectOptionId,
								secondWrongOptionId
							]
						}
					]
				})},
				0,
				0,
				0
			)
		`;

		const results = await Promise.allSettled([
			answerUserPracticeQuestion(
				userId,
				'concurrency-bank',
				firstQuestionId,
				firstWrongOptionId
			),
			answerUserPracticeQuestion(
				userId,
				'concurrency-bank',
				firstQuestionId,
				firstWrongOptionId
			)
		]);

		const fulfilled = results.filter(
			(result) => result.status === 'fulfilled'
		);
		const rejected = results.filter(
			(result) => result.status === 'rejected'
		);

		expect(fulfilled).toHaveLength(1);
		expect(rejected).toHaveLength(1);

		const fulfilledValue =
			fulfilled[0]?.status === 'fulfilled'
				? fulfilled[0].value
				: null;

		expect(fulfilledValue).toEqual({
			selectedOptionId: firstWrongOptionId,
			correct: false,
			correctOptionIds: [
				firstCorrectOptionId
			],
			completed: false,
			currentIndex: 1,
			answeredCount: 1,
			correctCount: 0,
			nextQuestion: {
				id: secondQuestionId,
				prompt: 'Second question',
				options: [
					{
						id: secondCorrectOptionId,
						content: 'Second correct'
					},
					{
						id: secondWrongOptionId,
						content: 'Second wrong'
					}
				]
			}
		});

		const rejectedReason =
			rejected[0]?.status === 'rejected'
				? rejected[0].reason
				: null;

		expect(rejectedReason).toBeInstanceOf(
			PracticeAnswerError
		);
		expect(
			(rejectedReason as PracticeAnswerError).status
		).toBe(409);

		const [progress] = await sql<{
			currentIndex: number;
			answeredCount: number;
			correctCount: number;
		}[]>`
			SELECT
				current_index AS "currentIndex",
				answered_count AS "answeredCount",
				correct_count AS "correctCount"
			FROM practice_progress
			WHERE user_id = ${userId}
				AND bank_id = ${bankId}
		`;

		expect(progress).toEqual({
			currentIndex: 1,
			answeredCount: 1,
			correctCount: 0
		});

		const [wrongCount] = await sql<{
			count: number;
		}[]>`
			SELECT count(*)::int AS count
			FROM user_wrong_questions
			WHERE user_id = ${userId}
				AND question_id = ${firstQuestionId}
		`;

		expect(wrongCount?.count).toBe(1);
	});
});
