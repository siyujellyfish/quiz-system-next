ALTER TABLE "practice_progress"
	ADD COLUMN IF NOT EXISTS "answered_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "practice_progress"
	ADD COLUMN IF NOT EXISTS "correct_count" integer DEFAULT 0 NOT NULL;
