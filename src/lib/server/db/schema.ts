import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	smallint,
	text,
	uniqueIndex,
	uuid,
	varchar,
	timestamp
} from "drizzle-orm/pg-core";
import { sql } from 'drizzle-orm';

import type {
	ExamAnswers,
	PracticeQuestionsState
} from '$lib/types/quiz';

export const users = pgTable("users", {
	id: uuid("id")
		.defaultRandom()
		.primaryKey(),

	username: varchar("username", {
		length: 64,
	})
		.notNull()
		.unique(),

	passwordHash: text("password_hash")
		.notNull(),

	isAdmin: boolean("is_admin")
		.notNull()
		.default(false),
});

export const userSessions = pgTable(
	'user_sessions',
	{
		tokenHash: varchar('token_hash', {
			length: 64
		}).primaryKey(),

		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, {
				onDelete: 'cascade'
			}),

		expiresAt: timestamp('expires_at', {
			withTimezone: true,
			mode: 'date'
		}).notNull(),

		createdAt: timestamp('created_at', {
			withTimezone: true,
			mode: 'date'
		})
			.defaultNow()
			.notNull()
	},
	(table) => [
		index('user_sessions_user_id_idx')
			.on(table.userId),

		index('user_sessions_expires_at_idx')
			.on(table.expiresAt)
	]
);

export const questionBanks = pgTable("question_banks", {
	id: uuid("id")
		.defaultRandom()
		.primaryKey(),

	slug: varchar("slug", {
		length: 64,
	})
		.notNull()
		.unique(),

	name: varchar("name", {
		length: 128,
	})
		.notNull(),

	description: text("description"),
});

export const questions = pgTable(
	"questions",
	{
		id: uuid("id")
			.defaultRandom()
			.primaryKey(),

		bankId: uuid("bank_id")
			.notNull()
			.references(
				() => questionBanks.id,
				{
					onDelete: "cascade",
				},
			),

		prompt: text("prompt")
			.notNull(),

		explanation: text("explanation"),
	},
	(table) => [
		index("questions_bank_id_idx")
			.on(table.bankId),
	],
);

export const questionOptions = pgTable(
	"question_options",
	{
		id: uuid("id")
			.defaultRandom()
			.primaryKey(),

		questionId: uuid("question_id")
			.notNull()
			.references(
				() => questions.id,
				{
					onDelete: "cascade",
				},
			),

		content: text("content")
			.notNull(),

		isCorrect: boolean("is_correct")
			.notNull()
			.default(false),

		position: smallint("position")
			.notNull(),
	},
	(table) => [
		index("question_options_question_id_idx")
			.on(table.questionId),

		uniqueIndex("question_options_question_id_position_uidx")
			.on(
				table.questionId,
				table.position,
			),
	],
);

export const practiceProgress = pgTable(
	'practice_progress',
	{
		userId: uuid('user_id')
			.notNull()
			.references(
				() => users.id,
				{
					onDelete: 'cascade'
				}
			),

		bankId: uuid('bank_id')
			.notNull()
			.references(
				() => questionBanks.id,
				{
					onDelete: 'cascade'
				}
			),

		questionsState: jsonb('questions_state')
			.$type<PracticeQuestionsState>()
			.notNull(),

		currentIndex: integer('current_index')
			.notNull()
			.default(0),

		answeredCount: integer('answered_count')
			.notNull()
			.default(0),

		correctCount: integer('correct_count')
			.notNull()
			.default(0)
	},
	(table) => [
		primaryKey({
			name: 'practice_progress_pkey',
			columns: [
				table.userId,
				table.bankId
			]
		}),

		index(
			'practice_progress_bank_id_idx'
		).on(
			table.bankId
		)
	]
);

export const userWrongQuestions = pgTable(
	'user_wrong_questions',
	{
		userId: uuid('user_id')
			.notNull()
			.references(
				() => users.id,
				{
					onDelete: 'cascade'
				}
			),

		questionId: uuid('question_id')
			.notNull()
			.references(
				() => questions.id,
				{
					onDelete: 'cascade'
				}
			)
	},
	(table) => [
		primaryKey({
			name: 'user_wrong_questions_pkey',
			columns: [
				table.userId,
				table.questionId
			]
		}),

		index(
			'user_wrong_questions_question_id_idx'
		).on(
			table.questionId
		)
	]
);

export const examAttempts = pgTable(
	'exam_attempts',
	{
		id: uuid('id')
			.defaultRandom()
			.primaryKey(),

		userId: uuid('user_id')
			.notNull()
			.references(
				() => users.id,
				{
					onDelete: 'cascade'
				}
			),

		bankId: uuid('bank_id')
			.references(
				() => questionBanks.id,
				{
					onDelete: 'set null'
				}
			),

		bankName: varchar('bank_name', {
			length: 128
		}).notNull(),

		startedAt: timestamp('started_at', {
			withTimezone: true,
			mode: 'date'
		})
			.defaultNow()
			.notNull(),

		submittedAt: timestamp('submitted_at', {
			withTimezone: true,
			mode: 'date'
		}),

		totalQuestions: integer('total_questions')
			.notNull(),

		answeredCount: integer('answered_count'),
		correctCount: integer('correct_count'),
		incorrectCount: integer('incorrect_count'),
		elapsedSeconds: integer('elapsed_seconds'),

		answers: jsonb('answers')
			.$type<ExamAnswers>()
	},
	(table) => [
		index('exam_attempts_user_submitted_at_idx')
			.on(
				table.userId,
				table.submittedAt
			),

		index('exam_attempts_bank_id_idx')
			.on(table.bankId),

		uniqueIndex('exam_attempts_active_user_bank_uidx')
			.on(
				table.userId,
				table.bankId
			)
			.where(
				sql`${table.submittedAt} is null`
			)
	]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type QuestionBank = typeof questionBanks.$inferSelect;
export type NewQuestionBank = typeof questionBanks.$inferInsert;

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;

export type QuestionOption = typeof questionOptions.$inferSelect;
export type NewQuestionOption = typeof questionOptions.$inferInsert;

export type PracticeProgress = typeof practiceProgress.$inferSelect;
export type NewPracticeProgress = typeof practiceProgress.$inferInsert;

export type ExamAttempt = typeof examAttempts.$inferSelect;
export type NewExamAttempt = typeof examAttempts.$inferInsert;
