CREATE TYPE "public"."email_account_status" AS ENUM('pending', 'connected', 'disconnected', 'error');--> statement-breakpoint
CREATE TYPE "public"."inbound_email_status" AS ENUM('received', 'processed', 'ignored', 'failed');--> statement-breakpoint
CREATE TYPE "public"."shipment_source" AS ENUM('manual', 'email');--> statement-breakpoint
CREATE TABLE "email_accounts" (
	"id" text PRIMARY KEY DEFAULT uuidv7()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"unipile_account_id" text,
	"provider" text,
	"email_address" text,
	"status" "email_account_status" DEFAULT 'pending' NOT NULL,
	"connect_token" text,
	"connect_token_expires_at" timestamp with time zone,
	"last_webhook_at" timestamp with time zone,
	CONSTRAINT "email_accounts_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "inbound_emails" (
	"id" text PRIMARY KEY DEFAULT uuidv7()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"email_account_id" text NOT NULL,
	"unipile_email_id" text NOT NULL,
	"message_id" text,
	"in_reply_to_message_id" text,
	"from_address" text NOT NULL,
	"subject" text,
	"invoice_number" text,
	"received_at" timestamp with time zone NOT NULL,
	"shipment_id" text,
	"status" "inbound_email_status" DEFAULT 'received' NOT NULL,
	"attachment_count" integer DEFAULT 0 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "inbound_emails_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "source" "shipment_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "email_intake_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "email_intake_invoice_number" text;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_email_account_id_email_accounts_id_fk" FOREIGN KEY ("email_account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_accounts_unipile_account_uidx" ON "email_accounts" USING btree ("unipile_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_accounts_connect_token_uidx" ON "email_accounts" USING btree ("connect_token");--> statement-breakpoint
CREATE INDEX "email_accounts_org_idx" ON "email_accounts" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_emails_account_email_uidx" ON "inbound_emails" USING btree ("email_account_id","unipile_email_id");--> statement-breakpoint
CREATE INDEX "inbound_emails_org_message_idx" ON "inbound_emails" USING btree ("organization_id","message_id");--> statement-breakpoint
CREATE INDEX "inbound_emails_org_invoice_idx" ON "inbound_emails" USING btree ("organization_id","invoice_number");--> statement-breakpoint
CREATE INDEX "inbound_emails_shipment_idx" ON "inbound_emails" USING btree ("shipment_id");