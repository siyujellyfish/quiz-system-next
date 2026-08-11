import {
	config
} from 'dotenv';

import {
	defineConfig
} from 'drizzle-kit';

config({
	path: '.env.local'
});

config();

const databaseUrl =
	process.env.DATABASE_URL_UNPOOLED ??
	process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error(
		'DATABASE_URL_UNPOOLED or DATABASE_URL is not set'
	);
}

export default defineConfig({
	out: './drizzle',
	schema:
		'./src/lib/server/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: {
		url: databaseUrl
	},
	verbose: true,
	strict: true
});
