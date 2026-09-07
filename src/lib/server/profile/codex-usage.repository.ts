import {
	eq
} from 'drizzle-orm';
import {
	boolean,
	jsonb,
	pgTable,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';

import type {
	CodexUsage
} from '$lib/server/integrations/codex-sandbox';

import {
	db
} from '$lib/server/db';
import {
	users
} from '$lib/server/db/schema';

const codexUsageSnapshots = pgTable(
	'codex_usage_snapshots',
	{
		userId: uuid('user_id')
			.primaryKey()
			.references(() => users.id, {
				onDelete: 'cascade'
			}),

		usage: jsonb('usage')
			.$type<CodexUsage>(),

		fetchError: boolean('fetch_error')
			.notNull()
			.default(false),

		updatedAt: timestamp('updated_at', {
			withTimezone: true,
			mode: 'date'
		})
			.defaultNow()
			.notNull()
	}
);

export async function getCodexUsageSnapshot(
	userId: string
) {
	const [snapshot] = await db
		.select()
		.from(codexUsageSnapshots)
		.where(
			eq(
				codexUsageSnapshots.userId,
				userId
			)
		)
		.limit(1);

	return snapshot ?? null;
}

export async function upsertCodexUsageSnapshot(
	userId: string,
	usage: CodexUsage | null,
	fetchError: boolean
) {
	const now = new Date();

	const [snapshot] = await db
		.insert(codexUsageSnapshots)
		.values({
			userId,
			usage,
			fetchError,
			updatedAt: now
		})
		.onConflictDoUpdate({
			target: codexUsageSnapshots.userId,
			set: {
				usage,
				fetchError,
				updatedAt: now
			}
		})
		.returning();

	return snapshot;
}

export async function deleteCodexUsageSnapshot(
	userId: string
) {
	await db
		.delete(codexUsageSnapshots)
		.where(
			eq(
				codexUsageSnapshots.userId,
				userId
			)
		);
}
