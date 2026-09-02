import { randomUUID } from 'node:crypto';

import { Pool } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import {
	hashPassword
} from '../src/lib/server/auth/password';

import {
	users
} from '../src/lib/server/db/schema';

config({ path: '.env.local' });
config();

const databaseUrl =
	process.env.DATABASE_URL_UNPOOLED?.trim() ||
	process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
	throw new Error(
		'DATABASE_URL_UNPOOLED or DATABASE_URL is not defined'
	);
}

function createNeonDatabase(url: string) {
	const pool = new Pool({
		connectionString: url
	});

	return {
		db: drizzleNeon(pool),
		close: () => pool.end()
	};
}

type Database = ReturnType<
	typeof createNeonDatabase
>['db'];

function createDatabase(url: string): {
	db: Database;
	close: () => Promise<void>;
} {
	if (process.env.DATABASE_DRIVER === 'postgres-js') {
		const client = postgres(url, {
			max: 1
		});

		return {
			db: drizzlePostgres(client) as unknown as Database,
			close: () => client.end()
		};
	}

	return createNeonDatabase(url);
}

const database = createDatabase(databaseUrl);
const db = database.db;

async function seedDefaultAdmin() {
	const username =
		process.env.DEFAULT_ADMIN_USERNAME?.trim();
	const password =
		process.env.DEFAULT_ADMIN_PASSWORD;

	if (!username || !password) {
		console.log(
			'- Skip default admin: DEFAULT_ADMIN_USERNAME or DEFAULT_ADMIN_PASSWORD is not defined'
		);
		return;
	}

	const [existing] = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.username, username))
		.limit(1);

	if (existing) {
		console.log(
			`- Skip default admin: ${username} already exists`
		);
		return;
	}

	const passwordHash = await hashPassword(password);

	await db.insert(users).values({
		id: randomUUID(),
		username,
		passwordHash,
		isAdmin: true
	});

	console.log(`+ Seeded default admin: ${username}`);
}

async function main() {
	console.log('Seeding default data...');

	try {
		await seedDefaultAdmin();
		console.log(
			'- Question banks are managed through Admin JSON import; no bundled question banks are seeded.'
		);
		console.log('Database seed completed.');
	} finally {
		await database.close();
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
