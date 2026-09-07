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
	createAiConversation,
	getAiConversationForUser
} from './conversation.repository';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error(
		'DATABASE_URL is required for PostgreSQL integration tests'
	);
}

const sql = postgres(databaseUrl, {
	max: 1
});

async function resetDatabase() {
	await sql.unsafe(`
		TRUNCATE TABLE
			ai_conversations,
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

describe('AskAI conversation ownership', () => {
	it('never resolves another user conversation UUID', async () => {
		const ownerId = randomUUID();
		const otherUserId = randomUUID();
		const bankId = randomUUID();
		const questionId = randomUUID();
		const providerThreadId =
			`thread-${randomUUID()}`;

		await sql`
			INSERT INTO users (id, username, password_hash)
			VALUES
				(${ownerId}, 'ask-ai-owner', 'hash'),
				(${otherUserId}, 'ask-ai-other', 'hash')
		`;
		await sql`
			INSERT INTO question_banks (id, slug, name)
			VALUES (${bankId}, 'ask-ai-bank', 'AskAI Bank')
		`;
		await sql`
			INSERT INTO questions (id, bank_id, prompt)
			VALUES (${questionId}, ${bankId}, 'AskAI question')
		`;

		const created = await createAiConversation({
			userId: ownerId,
			questionId,
			providerThreadId
		});

		expect(created).not.toBeNull();

		const ownerConversation =
			await getAiConversationForUser(
				created!.id,
				ownerId
			);
		const otherConversation =
			await getAiConversationForUser(
				created!.id,
				otherUserId
			);

		expect(ownerConversation).toMatchObject({
			id: created!.id,
			questionId,
			providerThreadId
		});
		expect(otherConversation).toBeNull();
	});
});
