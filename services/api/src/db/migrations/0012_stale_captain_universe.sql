ALTER TABLE "shipment_line_items" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "shipment_line_items" ADD COLUMN "alternates" jsonb;