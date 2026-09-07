CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_thread_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_conversations"
	ADD CONSTRAINT "ai_conversations_user_id_users_id_fk"
	FOREIGN KEY ("user_id")
	REFERENCES "public"."users"("id")
	ON DELETE cascade
	ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_conversations"
	ADD CONSTRAINT "ai_conversations_question_id_questions_id_fk"
	FOREIGN KEY ("question_id")
	REFERENCES "public"."questions"("id")
	ON DELETE cascade
	ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "ai_conversations_user_id_idx"
	ON "ai_conversations" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "ai_conversations_question_id_idx"
	ON "ai_conversations" USING btree ("question_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_conversations_provider_thread_uidx"
	ON "ai_conversations" USING btree ("provider", "provider_thread_id");
