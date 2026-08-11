import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
	options: SourceOption[];
};

type BankSeedDefinition = {
	slug: string;
	name: string;
	description: string;
	file: string;
};

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const projectRoot = path.resolve(
	currentDirectory,
	"..",
);

const bankDefinitions: BankSeedDefinition[] = [
	{
		slug: "csa-v2",
		name: "CSA v2",
		description: "CSA v2 全題庫",
		file: "src/data/csa-v2-questions.json",
	},
	{
		slug: "ctia",
		name: "CTIA",
		description: "CTIA 全題庫",
		file: "src/data/ctia-v2-questions.json",
	},
	{
		slug: "edrp",
		name: "EDRP",
		description: "EDRP 全題庫",
		file: "src/data/edrp-v3-questions.json",
	},
];

async function readQuestionFile(
	file: string,
): Promise<SourceQuestion[]> {
	const filePath = path.resolve(
		projectRoot,
		file,
	);

	const content = await readFile(
		filePath,
		{
			encoding: "utf-8",
		},
	);

	const data: unknown = JSON.parse(content);

	if (!Array.isArray(data)) {
		throw new Error(
			`${file} must contain an array`,
		);
	}

	return data as SourceQuestion[];
}

async function seedBank(
	definition: BankSeedDefinition,
) {
	const sourceQuestions = await readQuestionFile(
		definition.file,
	);

	const bankId = randomUUID();

	const questionRows = sourceQuestions.map(
		(sourceQuestion) => ({
			id: randomUUID(),
			bankId,
			prompt: sourceQuestion.prompt,
			explanation: null,
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