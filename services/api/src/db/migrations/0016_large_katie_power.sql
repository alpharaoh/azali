CREATE TYPE "public"."pga_determination_kind" AS ENUM('required', 'disclaim', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."pga_determination_status" AS ENUM('proposed', 'approved', 'corrected');--> statement-breakpoint
CREATE TYPE "public"."pga_flag_source" AS ENUM('flag_table', 'jurisdictional_analysis');--> statement-breakpoint
CREATE TYPE "public"."pga_flag_requirement" AS ENUM('may_be_required', 'required');--> statement-breakpoint
CREATE TABLE "line_item_pga_determinations" (
	"id" text PRIMARY KEY DEFAULT uuidv7()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"line_item_id" text NOT NULL,
	"agency_code" text NOT NULL,
	"agency_name" text,
	"program_code" text,
	"flag_code" text,
	"flag_source" "pga_flag_source" NOT NULL,
	"requirement" text,
	"determination" "pga_determination_kind" NOT NULL,
	"disclaim_code" text,
	"rationale" text NOT NULL,
	"data_elements" jsonb,
	"citations" jsonb,
	"confidence" double precision NOT NULL,
	"screening_run_id" text,
	"flag_version_id" text,
	"status" "pga_determination_status" DEFAULT 'proposed' NOT NULL,
	CONSTRAINT "line_item_pga_determinations_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "pga_flag_versions" (
	"id" text PRIMARY KEY DEFAULT uuidv7()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	"source" text NOT NULL,
	"pub_number" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"imported_at" timestamp with time zone NOT NULL,
	"record_count" integer NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	CONSTRAINT "pga_flag_versions_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "pga_flags" (
	"id" text PRIMARY KEY DEFAULT uuidv7()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	"version_id" text NOT NULL,
	"hts_prefix" text NOT NULL,
	"prefix_length" integer NOT NULL,
	"agency_code" text NOT NULL,
	"flag_code" text NOT NULL,
	"program_description" text,
	"requirement" "pga_flag_requirement" NOT NULL,
	CONSTRAINT "pga_flags_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "line_item_pga_determinations" ADD CONSTRAINT "line_item_pga_determinations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_item_pga_determinations" ADD CONSTRAINT "line_item_pga_determinations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_item_pga_determinations" ADD CONSTRAINT "line_item_pga_determinations_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_item_pga_determinations" ADD CONSTRAINT "line_item_pga_determinations_line_item_id_shipment_line_items_id_fk" FOREIGN KEY ("line_item_id") REFERENCES "public"."shipment_line_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_item_pga_determinations" ADD CONSTRAINT "line_item_pga_determinations_screening_run_id_agent_runs_id_fk" FOREIGN KEY ("screening_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_item_pga_determinations" ADD CONSTRAINT "line_item_pga_determinations_flag_version_id_pga_flag_versions_id_fk" FOREIGN KEY ("flag_version_id") REFERENCES "public"."pga_flag_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pga_flags" ADD CONSTRAINT "pga_flags_version_id_pga_flag_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."pga_flag_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "line_item_pga_determinations_org_shipment_idx" ON "line_item_pga_determinations" USING btree ("organization_id","shipment_id");--> statement-breakpoint
CREATE INDEX "line_item_pga_determinations_line_idx" ON "line_item_pga_determinations" USING btree ("line_item_id");--> statement-breakpoint
CREATE INDEX "pga_flags_version_prefix_idx" ON "pga_flags" USING btree ("version_id","hts_prefix");--> statement-breakpoint
CREATE INDEX "pga_flags_version_agency_idx" ON "pga_flags" USING btree ("version_id","agency_code");