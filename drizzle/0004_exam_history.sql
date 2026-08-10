CREATE TABLE "exam_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bank_id" uuid,
	"bank_name" varchar(128) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"total_questions" integer NOT NULL,
	"answered_count" integer,
	"correct_count" integer,
	"incorrect_count" integer,
	"elapsed_seconds" integer,
	"answers" jsonb
);
--> statement-breakpoint
ALTER TABLE "exam_attempts"
	ADD CONSTRAINT "exam_attempts_user_id_users_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
	ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exam_attempts"
	ADD CONSTRAINT "exam_attempts_bank_id_question_banks_id_fk"
	FOREIGN KEY ("bank_id") REFERENCES "public"."question_banks"("id")
	ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "exam_attempts_user_submitted_at_idx"
	ON "exam_attempts" USING btree ("user_id", "submitted_at");
--> statement-breakpoint
CREATE INDEX "exam_attempts_bank_id_idx"
	ON "exam_attempts" USING btree ("bank_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "exam_attempts_active_user_bank_uidx"
	ON "exam_attempts" USING btree ("user_id", "bank_id")
	WHERE "submitted_at" is null;
