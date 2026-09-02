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
	getQuestionBanksWithCount,
	getQuestionBankWithCountBySlug
} from '$lib/server/quiz/bank.repository';

import {
	getPracticeAnswerProgress,
	getPracticeProgress,
	getPracticeProgressSummariesByUser,
	getPracticeQuestionStateAtIndex
} from '$lib/server/quiz/practice.repository';

import {
	generatePracticeState
} from '$lib/server/quiz/practice.service';

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

describe('optimized quiz repository queries', () => {
	it('counts questions with options without multiplying option rows', async () => {
		const bankId = randomUUID();
		const emptyBankId = randomUUID();
		const firstQuestionId = randomUUID();
		const secondQuestionId = randomUUID();
		const noOptionQuestionId = randomUUID();

		await sql`
			INSERT INTO question_banks (id, slug, name)
			VALUES
				(${bankId}, 'alpha-bank', 'Alpha Bank'),
				(${emptyBankId}, 'empty-bank', 'Empty Bank')
		`;

		await sql`
			INSERT INTO questions (id, bank_id, prompt)
			VALUES
				(${firstQuestionId}, ${bankId}, 'First'),
				(${secondQuestionId}, ${bankId}, 'Second'),
				(${noOptionQuestionId}, ${bankId}, 'No options')
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
				(${randomUUID()}, ${firstQuestionId}, 'A', true, 0),
				(${randomUUID()}, ${firstQuestionId}, 'B', false, 1),
				(${randomUUID()}, ${secondQuestionId}, 'A', true, 0)
		`;

		const banks =
			await getQuestionBanksWithCount();

		expect(banks).toEqual([
			{
				id: bankId,
				slug: 'alpha-bank',
				name: 'Alpha Bank',
				description: null,
				questionCount: 2
			},
			{
				id: emptyBankId,
				slug: 'empty-bank',
				name: 'Empty Bank',
				description: null,
				questionCount: 0
			}
		]);

		const bank =
			await getQuestionBankWithCountBySlug(
				'alpha-bank'
			);

		expect(bank?.questionCount).toBe(2);
	});

	it('extracts compact practice fields without returning full questions state', async () => {
		const userId = randomUUID();
		const bankId = randomUUID();
		const firstQuestionId = randomUUID();
		const secondQuestionId = randomUUID();
		const thirdQuestionId = randomUUID();
		const firstOptionId = randomUUID();
		const secondOptionId = randomUUID();
		const thirdOptionId = randomUUID();

		await sql`
			INSERT INTO users (id, username, password_hash)
			VALUES (${userId}, 'summary-user', 'hash')
		`;

		await sql`
			INSERT INTO question_banks (id, slug, name)
			VALUES (${bankId}, 'summary-bank', 'Summary Bank')
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
							optionIds: [firstOptionId]
						},
						{
							questionId: secondQuestionId,
							optionIds: [secondOptionId]
						},
						{
							questionId: thirdQuestionId,
							optionIds: [thirdOptionId]
						}
					]
				})},
				1,
				1,
				1
			)
		`;

		const summaries =
			await getPracticeProgressSummariesByUser(
				userId
			);

		expect(summaries).toEqual([
			{
				bankId,
				currentIndex: 1,
				totalQuestions: 3,
				coverage: 50,
				shuffleOptions: true
			}
		]);

		const progress =
			await getPracticeProgress(
				userId,
				bankId
			);

		expect(progress).toEqual({
			currentIndex: 1,
			answeredCount: 1,
			correctCount: 1,
			totalQuestions: 3,
			coverage: 50,
			shuffleOptions: true,
			questionState: {
				questionId: secondQuestionId,
				optionIds: [secondOptionId]
			}
		});

		const answerProgress =
			await getPracticeAnswerProgress(
				userId,
				bankId
			);

		expect(answerProgress).toEqual({
			currentIndex: 1,
			answeredCount: 1,
			correctCount: 1,
			totalQuestions: 3,
			questionState: {
				questionId: secondQuestionId,
				optionIds: [secondOptionId]
			},
			nextQuestionState: {
				questionId: thirdQuestionId,
				optionIds: [thirdOptionId]
			}
		});

		const firstState =
			await getPracticeQuestionStateAtIndex(
				userId,
				bankId,
				0
			);

		expect(firstState).toEqual({
			questionId: firstQuestionId,
			optionIds: [firstOptionId]
		});
	});

	it('samples question ids before loading options for partial coverage', async () => {
		const bankId = randomUUID();
		const questionIds = Array.from(
			{ length: 10 },
			() => randomUUID()
		);

		await sql`
			INSERT INTO question_banks (id, slug, name)
			VALUES (${bankId}, 'sample-bank', 'Sample Bank')
		`;

		for (
			let index = 0;
			index < questionIds.length;
			index++
		) {
			const questionId =
				questionIds[index];

			if (!questionId) {
				continue;
			}

			await sql`
				INSERT INTO questions (id, bank_id, prompt)
				VALUES (
					${questionId},
					${bankId},
					${`Question ${index + 1}`}
				)
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
					(${randomUUID()}, ${questionId}, 'A', true, 0),
					(${randomUUID()}, ${questionId}, 'B', false, 1)
			`;
		}

		const state =
			await generatePracticeState(
				bankId,
				{
					coverage: 30,
					shuffleOptions: false
				}
			);

		expect(state.questions).toHaveLength(3);
		expect(
			new Set(
				state.questions.map(
					(question) => question.questionId
				)
			).size
		).toBe(3);
		expect(
			state.questions.every(
				(question) =>
					question.optionIds.length === 2
			)
		).toBe(true);
	});
});
