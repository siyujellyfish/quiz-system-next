ALTER TABLE "practice_progress" ADD COLUMN "answered_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "practice_progress" ADD COLUMN "correct_count" integer DEFAULT 0 NOT NULL;
