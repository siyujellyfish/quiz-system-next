import {
	config
} from 'dotenv';
import {
	drizzle
} from 'drizzle-orm/postgres-js';
import {
	migrate
} from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

config({
	path: '.env.local'
});
config();

const databaseUrl =
	process.env.DATABASE_URL_UNPOOLED?.trim() ||
	process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
	throw new Error(
		'DATABASE_URL_UNPOOLED or DATABASE_URL is not defined'
	);
}

function describeDatabase(url: string) {
	try {
		const parsed = new URL(url);
		return `${parsed.hostname}${parsed.pathname}`;
	} catch {
		return '<invalid database URL>';
	}
}

function logMigrationError(error: unknown) {
	console.error('Database migration failed.');
	console.error(error);

	if (
		error instanceof Error &&
		error.cause
	) {
		console.error('Caused by:');
		console.error(error.cause);
	}
}

const client = postgres(
	databaseUrl,
	{
		max: 1,
		prepare: false
	}
);
const db = drizzle(client);

console.log(
	`Applying migrations to ${describeDatabase(databaseUrl)}...`
);

try {
	await migrate(
		db,
		{
			migrationsFolder: './drizzle'
		}
	);
	console.log('Database migrations applied successfully.');
} catch (error) {
	logMigrationError(error);
	process.exitCode = 1;
} finally {
	await client.end();
}
