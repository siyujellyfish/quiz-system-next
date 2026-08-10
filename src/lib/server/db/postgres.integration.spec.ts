import { randomUUID } from 'node:crypto';

import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error('DATABASE_URL is required for PostgreSQL integration tests');
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

describe('PostgreSQL schema integration', () => {
	it('enforces bank, option-position, and wrong-question uniqueness', async () => {
		const bankId = randomUUID();
		const questionId = randomUUID();
		const userId = randomUUID();

		await sql`
			INSERT INTO question_banks (id, slug, name)
			VALUES (${bankId}, 'integration-bank', 'Integration Bank')
		`;

		await expect(
			sql`
				INSERT INTO question_banks (id, slug, name)
				VALUES (${randomUUID()}, 'integration-bank', 'Duplicate Bank')
			`
		).rejects.toMatchObject({ code: '23505' });

		await sql`
			INSERT INTO questions (id, bank_id, prompt)
			VALUES (${questionId}, ${bankId}, 'Question')
		`;

		await sql`
			INSERT INTO question_options (id, question_id, content, is_correct, position)
			VALUES (${randomUUID()}, ${questionId}, 'A', true, 0)
		`;

		await expect(
			sql`
				INSERT INTO question_options (id, question_id, content, is_correct, position)
				VALUES (${randomUUID()}, ${questionId}, 'B', false, 0)
			`
		).rejects.toMatchObject({ code: '23505' });

		await sql`
			INSERT INTO users (id, username, password_hash)
			VALUES (${userId}, 'integration-user', 'hash')
		`;

		await sql`
			INSERT INTO user_wrong_questions (user_id, question_id)
			VALUES (${userId}, ${questionId})
		`;

		await expect(
			sql`
				INSERT INTO user_wrong_questions (user_id, question_id)
				VALUES (${userId}, ${questionId})
			`
		).rejects.toMatchObject({ code: '23505' });
	});

	it('cascades deleted questions and banks through quiz state', async () => {
		const bankId = randomUUID();
		const questionId = randomUUID();
		const optionId = randomUUID();
		const userId = randomUUID();

		await sql`
			INSERT INTO users (id, username, password_hash)
			VALUES (${userId}, 'cascade-user', 'hash')
		`;

		await sql`
			INSERT INTO question_banks (id, slug, name)
			VALUES (${bankId}, 'cascade-bank', 'Cascade Bank')
		`;

		await sql`
			INSERT INTO questions (id, bank_id, prompt)
			VALUES (${questionId}, ${bankId}, 'Question')
		`;

		await sql`
			INSERT INTO question_options (id, question_id, content, is_correct, position)
			VALUES (${optionId}, ${questionId}, 'A', true, 0)
		`;

		await sql`
			INSERT INTO user_wrong_questions (user_id, question_id)
			VALUES (${userId}, ${questionId})
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
					shuffleOptions: true,
					questions: [
						{
							questionId,
							optionIds: [optionId]
						}
					]
				})},
				0,
				0,
				0
			)
		`;

		await sql`DELETE FROM questions WHERE id = ${questionId}`;

		const [optionCount] = await sql<{ count: number }[]>`
			SELECT count(*)::int AS count
			FROM question_options
		`;
		const [wrongCount] = await sql<{ count: number }[]>`
			SELECT count(*)::int AS count
			FROM user_wrong_questions
		`;
		const [progressBeforeBankDelete] = await sql<{ count: number }[]>`
			SELECT count(*)::int AS count
			FROM practice_progress
		`;

		expect(optionCount?.count).toBe(0);
		expect(wrongCount?.count).toBe(0);
		expect(progressBeforeBankDelete?.count).toBe(1);

		await sql`DELETE FROM question_banks WHERE id = ${bankId}`;

		const [progressAfterBankDelete] = await sql<{ count: number }[]>`
			SELECT count(*)::int AS count
			FROM practice_progress
		`;

		expect(progressAfterBankDelete?.count).toBe(0);
	});

	it('rolls back a failed multi-table transaction', async () => {
		const bankId = randomUUID();

		await expect(
			sql.begin(async (transaction) => {
				await transaction`
					INSERT INTO question_banks (id, slug, name)
					VALUES (${bankId}, 'rollback-bank', 'Rollback Bank')
				`;

				await transaction`
					INSERT INTO questions (id, bank_id, prompt)
					VALUES (${randomUUID()}, ${bankId}, 'Rollback Question')
				`;

				throw new Error('force rollback');
			})
		).rejects.toThrow('force rollback');

		const [bankCount] = await sql<{ count: number }[]>`
			SELECT count(*)::int AS count
			FROM question_banks
			WHERE id = ${bankId}
		`;
		const [questionCount] = await sql<{ count: number }[]>`
			SELECT count(*)::int AS count
			FROM questions
		`;

		expect(bankCount?.count).toBe(0);
		expect(questionCount?.count).toBe(0);
	});
});
