CREATE TYPE "public"."shipment_document_category" AS ENUM('commercial_invoice', 'packing_list', 'bill_of_lading', 'arrival_notice', 'other');--> statement-breakpoint
CREATE TYPE "public"."shipment_document_status" AS ENUM('pending', 'extracted', 'failed');--> statement-breakpoint
CREATE TABLE "shipment_documents" (
	"id" text PRIMARY KEY DEFAULT uuidv7()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"shipment_id" text,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"category" "shipment_document_category" DEFAULT 'other' NOT NULL,
	"storage_key" text NOT NULL,
	"preview_key" text,
	"page_count" integer,
	"status" "shipment_document_status" DEFAULT 'pending' NOT NULL,
	"extraction" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"failure_reason" text,
	CONSTRAINT "shipment_documents_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "shipment_documents" ADD CONSTRAINT "shipment_documents_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_documents" ADD CONSTRAINT "shipment_documents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_documents" ADD CONSTRAINT "shipment_documents_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipment_documents_shipment_idx" ON "shipment_documents" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "shipment_documents_org_created_idx" ON "shipment_documents" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shipment_documents_storage_key_uidx" ON "shipment_documents" USING btree ("storage_key");