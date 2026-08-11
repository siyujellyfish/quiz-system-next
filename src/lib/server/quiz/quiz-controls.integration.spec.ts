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
	startPractice
} from '$lib/server/quiz/practice.service';
import {
	clearWrongQuestions
} from '$lib/server/quiz/wrong.service';

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

describe('quiz session controls', () => {
	it('restarts practice with fresh progress while preserving wrong questions', async () => {
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
			VALUES (${userId}, 'restart-user', 'hash')
		`;

		await sql`
			INSERT INTO question_banks (id, slug, name)
			VALUES (${bankId}, 'restart-bank', 'Restart Bank')
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
					coverage: 50,
					shuffleOptions: true,
					questions: [
						{
							questionId: firstQuestionId,
							optionIds: [
								firstCorrectOptionId,
								firstWrongOptionId
							]
						}
					]
				})},
				1,
				1,
				1
			)
		`;

		await sql`
			INSERT INTO user_wrong_questions (user_id, question_id)
			VALUES (${userId}, ${firstQuestionId})
		`;

		const questionsState = await startPractice(
			userId,
			bankId,
			{
				coverage: 100,
				shuffleOptions: false
			}
		);

		expect(questionsState.coverage).toBe(100);
		expect(questionsState.shuffleOptions).toBe(false);
		expect(questionsState.questions).toHaveLength(2);

		const [progress] = await sql<{
			currentIndex: number;
			answeredCount: number;
			correctCount: number;
			questionsState: {
				coverage: number;
				shuffleOptions: boolean;
			};
		}[]>`
			SELECT
				current_index AS "currentIndex",
				answered_count AS "answeredCount",
				correct_count AS "correctCount",
				questions_state AS "questionsState"
			FROM practice_progress
			WHERE user_id = ${userId}
				AND bank_id = ${bankId}
		`;

		expect(progress?.currentIndex).toBe(0);
		expect(progress?.answeredCount).toBe(0);
		expect(progress?.correctCount).toBe(0);
		expect(progress?.questionsState.coverage).toBe(100);
		expect(progress?.questionsState.shuffleOptions).toBe(false);

		const [wrongCount] = await sql<{ count: number }[]>`
			SELECT count(*)::int AS count
			FROM user_wrong_questions
			WHERE user_id = ${userId}
		`;

		expect(wrongCount?.count).toBe(1);
	});

	it('clears wrong questions only for the requested bank', async () => {
		const userId = randomUUID();
		const firstBankId = randomUUID();
		const secondBankId = randomUUID();
		const firstQuestionId = randomUUID();
		const secondQuestionId = randomUUID();

		await sql`
			INSERT INTO users (id, username, password_hash)
			VALUES (${userId}, 'wrong-clear-user', 'hash')
		`;

		await sql`
			INSERT INTO question_banks (id, slug, name)
			VALUES
				(${firstBankId}, 'first-wrong-bank', 'First Wrong Bank'),
				(${secondBankId}, 'second-wrong-bank', 'Second Wrong Bank')
		`;

		await sql`
			INSERT INTO questions (id, bank_id, prompt)
			VALUES
				(${firstQuestionId}, ${firstBankId}, 'First bank question'),
				(${secondQuestionId}, ${secondBankId}, 'Second bank question')
		`;

		await sql`
			INSERT INTO user_wrong_questions (user_id, question_id)
			VALUES
				(${userId}, ${firstQuestionId}),
				(${userId}, ${secondQuestionId})
		`;

		const clearedCount = await clearWrongQuestions(
			userId,
			firstBankId
		);

		expect(clearedCount).toBe(1);

		const remaining = await sql<{
			questionId: string;
		}[]>`
			SELECT question_id AS "questionId"
			FROM user_wrong_questions
			WHERE user_id = ${userId}
		`;

		expect(remaining).toEqual([
			{
				questionId: secondQuestionId
			}
		]);
	});
});
