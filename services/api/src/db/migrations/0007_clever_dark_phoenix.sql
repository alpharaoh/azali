CREATE TYPE "public"."agent_run_item_kind" AS ENUM('reasoning', 'tool_call', 'tool_result', 'text');--> statement-breakpoint
CREATE TYPE "public"."agent_run_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "agent_run_items" (
	"id" text PRIMARY KEY DEFAULT uuidv7()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"run_id" text NOT NULL,
	"step_index" integer NOT NULL,
	"item_index" integer NOT NULL,
	"kind" "agent_run_item_kind" NOT NULL,
	"tool_name" text,
	"tool_call_id" text,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "agent_run_items_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" text PRIMARY KEY DEFAULT uuidv7()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"shipment_id" text,
	"agent" text NOT NULL,
	"status" "agent_run_status" DEFAULT 'running' NOT NULL,
	"model" text NOT NULL,
	"prompt_name" text,
	"prompt_version" integer,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"trace_id" text,
	"step_count" integer DEFAULT 0 NOT NULL,
	"tool_call_count" integer DEFAULT 0 NOT NULL,
	"input_tokens" bigint,
	"output_tokens" bigint,
	"total_tokens" bigint,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	CONSTRAINT "agent_runs_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "agent_run_items" ADD CONSTRAINT "agent_run_items_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run_items" ADD CONSTRAINT "agent_run_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run_items" ADD CONSTRAINT "agent_run_items_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_run_items_run_idx" ON "agent_run_items" USING btree ("run_id","step_index","item_index");--> statement-breakpoint
CREATE INDEX "agent_run_items_org_tool_idx" ON "agent_run_items" USING btree ("organization_id","tool_name");--> statement-breakpoint
CREATE INDEX "agent_runs_shipment_idx" ON "agent_runs" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "agent_runs_org_created_idx" ON "agent_runs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_runs_org_agent_idx" ON "agent_runs" USING btree ("organization_id","agent");