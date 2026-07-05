CREATE TYPE "public"."shipment_stage" AS ENUM('intake', 'classification', 'compliance', 'entry', 'filed', 'released');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('autopilot', 'needs_review', 'awaiting_cbp', 'released');--> statement-breakpoint
CREATE TABLE "shipment_events" (
	"id" text PRIMARY KEY DEFAULT uuidv7()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"type" text NOT NULL,
	"actor" text DEFAULT 'system' NOT NULL,
	"title" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "shipment_events_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" text PRIMARY KEY DEFAULT uuidv7()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"client_id" text NOT NULL,
	"reference" text NOT NULL,
	"entry_number" text,
	"stage" "shipment_stage" DEFAULT 'intake' NOT NULL,
	"status" "shipment_status" DEFAULT 'autopilot' NOT NULL,
	"review_deadline_at" timestamp with time zone,
	"origin_country" text NOT NULL,
	"origin_port" text,
	"port_of_entry" text NOT NULL,
	"transport_mode" text NOT NULL,
	"conveyance" text,
	"eta_at" timestamp with time zone,
	"value_cents" bigint NOT NULL,
	"duty_cents" bigint DEFAULT 0 NOT NULL,
	"incoterm" text,
	"entry_type" text,
	CONSTRAINT "shipments_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipment_events_shipment_occurred_idx" ON "shipment_events" USING btree ("shipment_id","occurred_at");--> statement-breakpoint
CREATE INDEX "shipment_events_org_occurred_idx" ON "shipment_events" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "shipment_events_org_type_idx" ON "shipment_events" USING btree ("organization_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "shipments_org_reference_uidx" ON "shipments" USING btree ("organization_id","reference");