ALTER TABLE "external_accounts"
	ADD COLUMN "plan_type" varchar(64);
--> statement-breakpoint
ALTER TABLE "external_accounts"
	ADD COLUMN "codex_profile_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "external_accounts"
	DROP COLUMN "access_token_encrypted";
--> statement-breakpoint
ALTER TABLE "external_accounts"
	DROP COLUMN "refresh_token_encrypted";
--> statement-breakpoint
ALTER TABLE "external_accounts"
	DROP COLUMN "scope";
--> statement-breakpoint
ALTER TABLE "external_accounts"
	DROP COLUMN "token_expires_at";
