import {
	neon
} from '@neondatabase/serverless';
import {
	config
} from 'dotenv';
import {
	drizzle as drizzleNeon
} from 'drizzle-orm/neon-http';
import {
	migrate as migrateNeon
} from 'drizzle-orm/neon-http/migrator';
import {
	drizzle as drizzlePostgres
} from 'drizzle-orm/postgres-js';
import {
	migrate as migratePostgres
} from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

config({
	path: '.env.local'
});
config();

const configuredUrls = [
	['MIGRATION_DATABASE_URL', process.env.MIGRATION_DATABASE_URL],
	['DATABASE_URL', process.env.DATABASE_URL],
	['DATABASE_URL_UNPOOLED', process.env.DATABASE_URL_UNPOOLED]
] as const;

const selectedDatabase = configuredUrls.find(
	([, value]) => value?.trim()
);

if (!selectedDatabase) {
	throw new Error(
		'MIGRATION_DATABASE_URL, DATABASE_URL, or DATABASE_URL_UNPOOLED is not defined'
	);
}

const [databaseUrlSource, rawDatabaseUrl] =
	selectedDatabase;
const databaseUrl = rawDatabaseUrl!.trim();

function parseDatabaseUrl(url: string) {
	try {
		return new URL(url);
	} catch {
		throw new Error('Database URL is invalid');
	}
}

function describeDatabase(url: URL) {
	return `${url.hostname}${url.pathname}`;
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

const parsedDatabaseUrl = parseDatabaseUrl(
	databaseUrl
);
const isNeon =
	parsedDatabaseUrl.hostname.endsWith(
		'.neon.tech'
	);

console.log(
	`Applying migrations using ${databaseUrlSource} to ${describeDatabase(parsedDatabaseUrl)} via ${isNeon ? 'Neon HTTP' : 'PostgreSQL'}...`
);

try {
	if (isNeon) {
		const client = neon(databaseUrl);
		const db = drizzleNeon(client);

		await migrateNeon(
			db,
			{
				migrationsFolder: './drizzle'
			}
		);
	} else {
		const client = postgres(
			databaseUrl,
			{
				max: 1,
				prepare: false
			}
		);

		try {
			const db = drizzlePostgres(client);

			await migratePostgres(
				db,
				{
					migrationsFolder: './drizzle'
				}
			);
		} finally {
			await client.end();
		}
	}

	console.log('Database migrations applied successfully.');
} catch (error) {
	logMigrationError(error);
	process.exitCode = 1;
}
