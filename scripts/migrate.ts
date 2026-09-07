import {
	neon
} from '@neondatabase/serverless';
import {
	config
} from 'dotenv';
import {
	drizzle
} from 'drizzle-orm/neon-http';
import {
	migrate
} from 'drizzle-orm/neon-http/migrator';

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

const client = neon(databaseUrl);
const db = drizzle(client);

console.log(
	`Applying migrations over Neon HTTP using ${databaseUrlSource} to ${describeDatabase(databaseUrl)}...`
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
}
