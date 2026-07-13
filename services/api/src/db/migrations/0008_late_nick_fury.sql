CREATE TYPE "public"."line_item_status" AS ENUM('pending', 'classified', 'needs_review', 'approved', 'corrected');--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY DEFAULT uuidv7()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"description" text,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"hts_code" text,
	"hts_description" text,
	"confidence" double precision,
	"duty_rate" jsonb,
	"classification_run_id" text,
	"classified_at" timestamp with time zone,
	"source" text,
	CONSTRAINT "products_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "shipment_line_items" (
	"id" text PRIMARY KEY DEFAULT uuidv7()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"product_id" text,
	"line_number" integer NOT NULL,
	"description" text NOT NULL,
	"sku" text,
	"quantity" double precision,
	"unit" text,
	"unit_value_cents" bigint,
	"total_value_cents" bigint,
	"origin_country" text,
	"declared_hts" text,
	"hts_code" text,
	"hts_description" text,
	"confidence" double precision,
	"duty_rate" jsonb,
	"classification_run_id" text,
	"reused_from_product" boolean DEFAULT false NOT NULL,
	"status" "line_item_status" DEFAULT 'pending' NOT NULL,
	CONSTRAINT "shipment_line_items_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_classification_run_id_agent_runs_id_fk" FOREIGN KEY ("classification_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_line_items" ADD CONSTRAINT "shipment_line_items_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_line_items" ADD CONSTRAINT "shipment_line_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_line_items" ADD CONSTRAINT "shipment_line_items_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_line_items" ADD CONSTRAINT "shipment_line_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_line_items" ADD CONSTRAINT "shipment_line_items_classification_run_id_agent_runs_id_fk" FOREIGN KEY ("classification_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_org_client_idx" ON "products" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_org_client_sku_uidx" ON "products" USING btree ("organization_id","client_id","sku") WHERE "products"."sku" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "shipment_line_items_shipment_line_uidx" ON "shipment_line_items" USING btree ("shipment_id","line_number");--> statement-breakpoint
CREATE INDEX "shipment_line_items_org_shipment_idx" ON "shipment_line_items" USING btree ("organization_id","shipment_id");--> statement-breakpoint
CREATE INDEX "shipment_line_items_product_idx" ON "shipment_line_items" USING btree ("product_id");