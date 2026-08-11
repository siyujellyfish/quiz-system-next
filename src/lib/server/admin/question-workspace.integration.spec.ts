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
	getAdminQuestionWorkspace
} from '$lib/server/admin/question-workspace.repository';

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

describe('admin question workbench', () => {
	it('filters by prompt and returns the selected question editor', async () => {
		const bankId = randomUUID();
		const networkQuestionId = randomUUID();
		const otherQuestionId = randomUUID();

		await sql`
			INSERT INTO question_banks (id, slug, name)
			VALUES (${bankId}, 'workspace-bank', 'Workspace Bank')
		`;

		await sql`
			INSERT INTO questions (id, bank_id, prompt)
			VALUES
				(${networkQuestionId}, ${bankId}, 'Which network control is appropriate?'),
				(${otherQuestionId}, ${bankId}, 'Unrelated recovery question')
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
				(${randomUUID()}, ${networkQuestionId}, 'Allow', true, 0),
				(${randomUUID()}, ${networkQuestionId}, 'Deny', false, 1),
				(${randomUUID()}, ${otherQuestionId}, 'Restore', true, 0),
				(${randomUUID()}, ${otherQuestionId}, 'Respond', false, 1)
		`;

		const workspace =
			await getAdminQuestionWorkspace({
				bankId,
				query: 'network',
				health: 'all',
				questionId:
					networkQuestionId
			});

		expect(workspace.total).toBe(1);
		expect(workspace.position).toBe(1);
		expect(
			workspace.currentQuestion?.id
		).toBe(networkQuestionId);
		expect(
			workspace.currentQuestion?.options
		).toHaveLength(2);
		expect(
			workspace.previousQuestionId
		).toBeNull();
		expect(
			workspace.nextQuestionId
		).toBeNull();
	});

	it('filters by option content without changing question health counts', async () => {
		const bankId = randomUUID();
		const matchingQuestionId = randomUUID();
		const otherQuestionId = randomUUID();

		await sql`
			INSERT INTO question_banks (id, slug, name)
			VALUES (${bankId}, 'option-search-bank', 'Option Search Bank')
		`;

		await sql`
			INSERT INTO questions (id, bank_id, prompt)
			VALUES
				(${matchingQuestionId}, ${bankId}, 'Choose the best architecture'),
				(${otherQuestionId}, ${bankId}, 'Choose the best recovery process')
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
				(${randomUUID()}, ${matchingQuestionId}, 'Centralized SIEM implementation', true, 0),
				(${randomUUID()}, ${matchingQuestionId}, 'Standalone endpoint logging', false, 1),
				(${randomUUID()}, ${matchingQuestionId}, 'Manual audit review', false, 2),
				(${randomUUID()}, ${otherQuestionId}, 'Warm site recovery', true, 0),
				(${randomUUID()}, ${otherQuestionId}, 'Cold site recovery', false, 1)
		`;

		const workspace =
			await getAdminQuestionWorkspace({
				bankId,
				query: 'centralized siem',
				health: 'healthy',
				questionId: null
			});

		expect(workspace.total).toBe(1);
		expect(
			workspace.currentQuestion?.id
		).toBe(matchingQuestionId);
		expect(
			workspace.currentSummary?.optionCount
		).toBe(3);
		expect(
			workspace.currentSummary?.correctOptionCount
		).toBe(1);
	});

	it('filters invalid questions by aggregate option health', async () => {
		const bankId = randomUUID();
		const healthyId = randomUUID();
		const invalidId = randomUUID();

		await sql`
			INSERT INTO question_banks (id, slug, name)
			VALUES (${bankId}, 'health-bank', 'Health Bank')
		`;

		await sql`
			INSERT INTO questions (id, bank_id, prompt)
			VALUES
				(${healthyId}, ${bankId}, 'Healthy question'),
				(${invalidId}, ${bankId}, 'Invalid question')
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
				(${randomUUID()}, ${healthyId}, 'Correct', true, 0),
				(${randomUUID()}, ${healthyId}, 'Wrong', false, 1),
				(${randomUUID()}, ${invalidId}, 'Only option', false, 0)
		`;

		const workspace =
			await getAdminQuestionWorkspace({
				bankId,
				query: '',
				health: 'invalid',
				questionId: healthyId
			});

		expect(workspace.total).toBe(1);
		expect(
			workspace.currentQuestion?.id
		).toBe(invalidId);
		expect(
			workspace.currentSummary?.optionCount
		).toBe(1);
		expect(
			workspace.currentSummary?.correctOptionCount
		).toBe(0);
	});
});
