ALTER TABLE "shipments" ALTER COLUMN "client_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "processing_state" text;