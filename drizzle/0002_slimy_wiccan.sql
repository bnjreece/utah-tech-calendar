CREATE TABLE "admin_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"alert_email" text,
	"notify_source_errors" boolean DEFAULT true NOT NULL,
	"notify_source_stale" boolean DEFAULT true NOT NULL,
	"notify_cookie_expiry" boolean DEFAULT true NOT NULL,
	"stale_threshold_hours" integer DEFAULT 24 NOT NULL,
	"last_alerts_sent_at" timestamp with time zone,
	"last_alerts_hash" text,
	"last_scrape_tick_at" timestamp with time zone,
	"last_queue_digest_run_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "hidden_reason" text;