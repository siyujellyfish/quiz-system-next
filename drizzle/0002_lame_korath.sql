CREATE TABLE IF NOT EXISTS "user_sessions" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_wrong_questions" (
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	CONSTRAINT "user_wrong_questions_pkey" PRIMARY KEY("user_id","question_id")
);
--> statement-breakpoint
DO $$
BEGIN
	ALTER TABLE "user_sessions"
		ADD CONSTRAINT "user_sessions_user_id_users_id_fk"
		FOREIGN KEY ("user_id")
		REFERENCES "public"."users"("id")
		ON DELETE cascade
		ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	ALTER TABLE "user_wrong_questions"
		ADD CONSTRAINT "user_wrong_questions_user_id_users_id_fk"
		FOREIGN KEY ("user_id")
		REFERENCES "public"."users"("id")
		ON DELETE cascade
		ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	ALTER TABLE "user_wrong_questions"
		ADD CONSTRAINT "user_wrong_questions_question_id_questions_id_fk"
		FOREIGN KEY ("question_id")
		REFERENCES "public"."questions"("id")
		ON DELETE cascade
		ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_user_id_idx"
	ON "user_sessions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_expires_at_idx"
	ON "user_sessions" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_wrong_questions_question_id_idx"
	ON "user_wrong_questions" USING btree ("question_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "practice_progress_bank_id_idx"
	ON "practice_progress" USING btree ("bank_id");
