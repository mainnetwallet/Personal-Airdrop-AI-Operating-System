DO $$ BEGIN
 CREATE TYPE "public"."memory_lifecycle" AS ENUM('NEW', 'CONFIRMED', 'VERIFIED', 'STALE', 'CORRECTED', 'ARCHIVED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."memory_type" AS ENUM('USER_PREFERENCE', 'PROJECT_FACT', 'PROJECT_EVENT', 'TASK_HISTORY', 'WORKFLOW', 'WORKFLOW_VERSION', 'FAILURE_RESOLUTION', 'DECISION', 'CHECKPOINT_HISTORY', 'PROJECT_CHANGE', 'PERSONAL_STRATEGY', 'ACTIVITY_PATTERN', 'SUCCESS_PATTERN', 'FAILURE_PATTERN', 'RESEARCH_FACT', 'DECISION_HISTORY');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memory_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"type" "memory_type" NOT NULL,
	"content" jsonb NOT NULL,
	"source" text NOT NULL,
	"confidence" text NOT NULL,
	"lifecycle" "memory_lifecycle" DEFAULT 'NEW' NOT NULL,
	"correction_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tool_registry" (
	"name" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"input_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"permission" text NOT NULL,
	"risk" text NOT NULL,
	"supported_devices" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timeout_ms" text NOT NULL,
	"retry_policy" jsonb DEFAULT '{"maxRetries":0,"backoffMs":0}'::jsonb NOT NULL,
	"audit_event" boolean DEFAULT true NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ALTER COLUMN "cost" SET DEFAULT '{"toolCalls":0,"amount":0}'::jsonb;--> statement-breakpoint
ALTER TABLE "agent_runs" ALTER COLUMN "cost" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "context" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "tools_used" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "steps" text DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "tool_calls" text DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "retries" text DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "errors" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "checkpoint_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "correlation_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "causation_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "schema_version" text DEFAULT '1' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memory_entries" ADD CONSTRAINT "memory_entries_agent_id_agent_identities_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_entries_agent_idx" ON "memory_entries" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_entries_type_idx" ON "memory_entries" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_parent_idx" ON "agent_runs" USING btree ("parent_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_correlation_idx" ON "events" USING btree ("correlation_id");