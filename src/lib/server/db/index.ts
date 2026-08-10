import {
	Pool
} from '@neondatabase/serverless';
import {
	drizzle as drizzleNeon
} from 'drizzle-orm/neon-serverless';
import postgres from 'postgres';
import {
	drizzle as drizzlePostgres
} from 'drizzle-orm/postgres-js';

import {
	env
} from '$env/dynamic/private';

import * as schema from './schema';

const databaseUrl = env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error('DATABASE_URL is not set');
}

function createNeonDatabase(url: string) {
	const pool = new Pool({
		connectionString: url
	});

	return drizzleNeon(pool, {
		schema
	});
}

type Database = ReturnType<
	typeof createNeonDatabase
>;

function createDatabase(
	url: string
): Database {
	if (env.DATABASE_DRIVER === 'postgres-js') {
		const client = postgres(url);

		return drizzlePostgres(client, {
			schema
		}) as unknown as Database;
	}

	return createNeonDatabase(url);
}

export const db = createDatabase(databaseUrl);
