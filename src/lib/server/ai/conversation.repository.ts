import {
	and,
	eq
} from 'drizzle-orm';
import {
	index,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
	varchar
} from 'drizzle-orm/pg-core';

import {
	db
} from '$lib/server/db';
import {
	questions,
	users
} from '$lib/server/db/schema';

export const aiConversations = pgTable(
	'ai_conversations',
	{
		id: uuid('id')
			.defaultRandom()
			.primaryKey(),

		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, {
				onDelete: 'cascade'
			}),

		questionId: uuid('question_id')
			.notNull()
			.references(() => questions.id, {
				onDelete: 'cascade'
			}),

		provider: varchar('provider', {
			length: 32
		}).notNull(),

		providerThreadId: varchar(
			'provider_thread_id',
			{
				length: 255
			}
		).notNull(),

		createdAt: timestamp('created_at', {
			withTimezone: true,
			mode: 'date'
		})
			.defaultNow()
			.notNull(),

		updatedAt: timestamp('updated_at', {
			withTimezone: true,
			mode: 'date'
		})
			.defaultNow()
			.notNull()
	},
	(table) => [
		index('ai_conversations_user_id_idx')
			.on(table.userId),
		index('ai_conversations_question_id_idx')
			.on(table.questionId),
		uniqueIndex(
			'ai_conversations_provider_thread_uidx'
		).on(
			table.provider,
			table.providerThreadId
		)
	]
);

const CODEX_PROVIDER = 'codex';

export async function createAiConversation(input: {
	userId: string;
	questionId: string;
	providerThreadId: string;
}) {
	const [conversation] = await db
		.insert(aiConversations)
		.values({
			userId: input.userId,
			questionId: input.questionId,
			provider: CODEX_PROVIDER,
			providerThreadId:
				input.providerThreadId
		})
		.returning({
			id: aiConversations.id,
			questionId:
				aiConversations.questionId,
			providerThreadId:
				aiConversations.providerThreadId
		});

	return conversation ?? null;
}

export async function getAiConversationForUser(
	conversationId: string,
	userId: string
) {
	const [conversation] = await db
		.select({
			id: aiConversations.id,
			questionId:
				aiConversations.questionId,
			providerThreadId:
				aiConversations.providerThreadId,
			updatedAt:
				aiConversations.updatedAt
		})
		.from(aiConversations)
		.where(
			and(
				eq(
					aiConversations.id,
					conversationId
				),
				eq(
					aiConversations.userId,
					userId
				),
				eq(
					aiConversations.provider,
					CODEX_PROVIDER
				)
			)
		)
		.limit(1);

	return conversation ?? null;
}

export async function touchAiConversation(
	conversationId: string,
	userId: string
) {
	await db
		.update(aiConversations)
		.set({
			updatedAt: new Date()
		})
		.where(
			and(
				eq(
					aiConversations.id,
					conversationId
				),
				eq(
					aiConversations.userId,
					userId
				)
			)
		);
}
