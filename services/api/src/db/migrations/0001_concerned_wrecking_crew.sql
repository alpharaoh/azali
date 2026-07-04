CREATE TYPE "public"."client_autonomy" AS ENUM('supervised', 'autopilot');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY DEFAULT uuidv7()::text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"image" text,
	"ior_number" text NOT NULL,
	"bond_number" text NOT NULL,
	"primary_origin" text NOT NULL,
	"industry" text NOT NULL,
	"autonomy" "client_autonomy" DEFAULT 'supervised' NOT NULL,
	"status" "client_status" DEFAULT 'active' NOT NULL,
	"ports_of_entry" text[] DEFAULT '{}' NOT NULL,
	CONSTRAINT "clients_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;