CREATE TABLE "codex_usage_snapshots" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"usage" jsonb,
	"fetch_error" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "codex_usage_snapshots"
	ADD CONSTRAINT "codex_usage_snapshots_user_id_users_id_fk"
	FOREIGN KEY ("user_id")
	REFERENCES "public"."users"("id")
	ON DELETE cascade
	ON UPDATE no action;
