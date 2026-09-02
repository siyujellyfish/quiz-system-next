import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import { Pool } from '@neondatabase/serverless';
import { config } from "dotenv";
import { inArray } from "drizzle-orm";
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
	hashPassword
} from '../src/lib/server/auth/password';

import {
	questionBanks,
	questionOptions,
	questions,
	users
} from "../src/lib/server/db/schema";

config({
	path: ".env.local",
});

config();

const databaseUrl =
	process.env.DATABASE_URL_UNPOOLED ??
	process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error(
		"DATABASE_URL_UNPOOLED or DATABASE_URL is not defined",
	);
}

function createNeonDatabase(url: string) {
	const pool = new Pool({
		connectionString: url,
	});

	return {
		db: drizzleNeon(pool),
		close: () => pool.end(),
	};
}

type Database = ReturnType<
	typeof createNeonDatabase
>["db"];

function createDatabase(url: string): {
	db: Database;
	close: () => Promise<void>;
} {
	if (process.env.DATABASE_DRIVER === 'postgres-js') {
		const client = postgres(url);

		return {
			db: drizzlePostgres({
				client,
			}) as unknown as Database,
			close: () => client.end(),
		};
	}

	return createNeonDatabase(url);
}

const database = createDatabase(databaseUrl);
const db = database.db;

type SourceOption = {
	id: string;
	text: string;
	isCorrect: boolean;
};

type SourceQuestion = {
	id: string;
	prompt: string;
	explanation?: string | null;
	options: SourceOption[];
};

type BankSeedDefinition = {
	slug: string;
	name: string;
	description: string;
	questions: SourceQuestion[];
};

type DefaultQuestionBankBundle = {
	version: 1;
	banks: BankSeedDefinition[];
};

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const projectRoot = path.resolve(
	currentDirectory,
	"..",
);

async function readDefaultQuestionBankBundle():
	Promise<DefaultQuestionBankBundle> {
	const directory = path.resolve(
		projectRoot,
		"src/data/default",
	);
	const filenames = (
		await readdir(directory)
	)
		.filter((filename) =>
			/^question-banks\.part\d+\.b64$/.test(filename)
		)
		.sort();

	if (filenames.length === 0) {
		throw new Error(
			"Default question bank bundle is missing",
		);
	}

	const chunks = await Promise.all(
		filenames.map((filename) =>
			readFile(
				path.join(directory, filename),
				"utf-8",
			)
		),
	);
	const encoded = chunks
		.join("")
		.replace(/\s+/g, "");
	const decoded = gunzipSync(
		Buffer.from(encoded, "base64"),
	).toString("utf-8");
	const data: unknown = JSON.parse(decoded);

	if (
		typeof data !== "object" ||
		data === null ||
		(data as { version?: unknown }).version !== 1 ||
		!Array.isArray(
			(data as { banks?: unknown }).banks,
		)
	) {
		throw new Error(
			"Default question bank bundle has an invalid format",
		);
	}

	return data as DefaultQuestionBankBundle;
}

function validateBankDefinition(
	definition: BankSeedDefinition,
): void {
	if (
		!definition.slug ||
		!definition.name ||
		!Array.isArray(definition.questions) ||
		definition.questions.length === 0
	) {
		throw new Error(
			`Invalid default question bank: ${definition.slug || definition.name}`,
		);
	}

	for (const question of definition.questions) {
		if (
			!question.id ||
			!question.prompt ||
			!Array.isArray(question.options) ||
			question.options.length === 0
		) {
			throw new Error(
				`Invalid question in ${definition.slug}`,
			);
		}

		const correctCount = question.options.filter(
			(option) => option.isCorrect,
		).length;

		if (correctCount !== 1) {
			throw new Error(
				`${definition.slug}/${question.id} must contain exactly one correct option`,
			);
		}
	}
}

async function seedBank(
	definition: BankSeedDefinition,
) {
	validateBankDefinition(definition);

	const bankId = randomUUID();

	const questionRows = definition.questions.map(
		(sourceQuestion) => ({
			id: randomUUID(),
			bankId,
			prompt: sourceQuestion.prompt,
			explanation:
				sourceQuestion.explanation ?? null,
			sourceQuestion,
		}),
	);

	const optionRows = questionRows.flatMap(
		(questionRow) =>
			questionRow.sourceQuestion.options.map(
				(sourceOption, position) => ({
					id: randomUUID(),
					questionId: questionRow.id,
					content: sourceOption.text,
					isCorrect: sourceOption.isCorrect,
					position,
				}),
			),
	);

	await db.transaction(async (tx) => {
		await tx
			.insert(questionBanks)
			.values({
				id: bankId,
				slug: definition.slug,
				name: definition.name,
				description: definition.description,
			});

		await tx
			.insert(questions)
			.values(
				questionRows.map((question) => ({
					id: question.id,
					bankId: question.bankId,
					prompt: question.prompt,
					explanation: question.explanation,
				})),
			);

		await tx
			.insert(questionOptions)
			.values(optionRows);
	});

	console.log(
		[
			`✓ ${definition.name}`,
			`${questionRows.length} questions`,
			`${optionRows.length} options`,
		].join(" | "),
	);
}

async function seedDefaultAdmin() {
	const username =
		process.env.DEFAULT_ADMIN_USERNAME ??
		'admin';
	const password =
		process.env.DEFAULT_ADMIN_PASSWORD ??
		'admin';

	const passwordHash =
	await hashPassword(
		password
	);

	await db
		.insert(users)
		.values({
			username,
			passwordHash,
			isAdmin: true,
		})
		.onConflictDoNothing({
			target: users.username,
		});

	console.log(`✓ Default admin: ${username}`);
}

async function main() {
	console.log("Starting database seed...\n");

	await seedDefaultAdmin();

	const bundle =
		await readDefaultQuestionBankBundle();
	const bankDefinitions = bundle.banks;
	const slugs = bankDefinitions.map(
		(definition) => definition.slug,
	);

	const existingBanks = await db
		.select({
			slug: questionBanks.slug,
		})
		.from(questionBanks)
		.where(
			inArray(
				questionBanks.slug,
				slugs,
			),
		);

	const existingSlugs = new Set(
		existingBanks.map((bank) => bank.slug),
	);

	for (const definition of bankDefinitions) {
		if (existingSlugs.has(definition.slug)) {
			console.log(
				`- Skip ${definition.name}: bank already exists`,
			);

			continue;
		}

		await seedBank(definition);
	}

	console.log("\nDatabase seed completed.");
}

main()
	.catch((error: unknown) => {
		console.error(
			"\nQuestion bank seed failed.",
		);

		if (error instanceof Error) {
			console.error(error.message);
		} else {
			console.error(error);
		}

		process.exitCode = 1;
	})
	.finally(async () => {
		await database.close();
	});
