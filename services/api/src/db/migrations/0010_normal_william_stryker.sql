ALTER TABLE "products" ADD COLUMN "reuse_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "last_reused_at" timestamp with time zone;--> statement-breakpoint
UPDATE "products" p SET "reuse_count" = s.cnt, "last_reused_at" = s.last_used
FROM (
  SELECT product_id, count(*)::int AS cnt,
         max(coalesce(updated_at, created_at)) AS last_used
  FROM shipment_line_items
  WHERE reused_from_product = true AND product_id IS NOT NULL
  GROUP BY product_id
) s
WHERE p.id = s.product_id;