DROP INDEX "products_org_client_sku_uidx";--> statement-breakpoint
CREATE INDEX "products_org_client_sku_idx" ON "products" USING btree ("organization_id","client_id","sku");