import {
	and,
	eq
} from 'drizzle-orm';

import {
	db
} from '$lib/server/db';

import {
	externalAccounts
} from '$lib/server/db/schema';

export const CHATGPT_PROVIDER = 'chatgpt';

export type UpsertChatgptConnectionInput = {
	userId: string;
	providerAccountId: string;
	displayName: string | null;
	email: string | null;
	planType: string | null;
	codexProfileId: string;
};

export async function getChatgptConnection(
	userId: string
) {
	const [connection] = await db
		.select()
		.from(externalAccounts)
		.where(
			and(
				eq(
					externalAccounts.userId,
					userId
				),
				eq(
					externalAccounts.provider,
					CHATGPT_PROVIDER
				)
			)
		)
		.limit(1);

	return connection ?? null;
}

export async function upsertChatgptConnection(
	input: UpsertChatgptConnectionInput
) {
	const now = new Date();

	const [connection] = await db
		.insert(externalAccounts)
		.values({
			userId: input.userId,
			provider: CHATGPT_PROVIDER,
			providerAccountId: input.providerAccountId,
			displayName: input.displayName,
			email: input.email,
			planType: input.planType,
			codexProfileId: input.codexProfileId,
			updatedAt: now
		})
		.onConflictDoUpdate({
			target: [
				externalAccounts.userId,
				externalAccounts.provider
			],
			set: {
				providerAccountId:
					input.providerAccountId,
				displayName: input.displayName,
				email: input.email,
				planType: input.planType,
				codexProfileId: input.codexProfileId,
				updatedAt: now
			}
		})
		.returning();

	return connection;
}

export async function deleteChatgptConnection(
	userId: string
) {
	await db
		.delete(externalAccounts)
		.where(
			and(
				eq(
					externalAccounts.userId,
					userId
				),
				eq(
					externalAccounts.provider,
					CHATGPT_PROVIDER
				)
			)
		);
}
