/**
 * One-off: wipe an organization's app data and clone another org's data into
 * it. Every row gets a fresh uuidv7 id; every UUID occurrence anywhere in the
 * copied rows (FK columns, jsonb payloads, storage keys) is rewritten through
 * the same id map, so event payloads keep pointing at the right cloned rows.
 * S3 document objects are copied to the target org's key prefix.
 *
 * Usage: bun src/db/seed/cloneOrgData.ts
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  agentRunItems,
  agentRuns,
  clients,
  products,
  shipmentDocuments,
  shipmentEvents,
  shipmentLineItems,
  shipments,
} from "@/db/schema";
import { BlobStorageService } from "@/services/external/s3/service";

const SOURCE_ORG = "6b2f0a45-b817-445b-b07e-b6e556f69684"; // Akaam's Org
const TARGET_ORG = "084ce6b8-b4ce-48fd-8bdf-dff9739c21aa"; // Mahmoud's Org
const TARGET_USER = "vASxVEGTNctj9ZTTosjqE4WkafEZtFGZ"; // Mahmoud Serewel

// Insert order respects FKs: clients ← shipments ← agent_runs ← items,
// products (→ clients, agent_runs), documents/line items/events (→ shipments).
const TABLES = [
  clients,
  shipments,
  agentRuns,
  agentRunItems,
  products,
  shipmentDocuments,
  shipmentLineItems,
  shipmentEvents,
] as const;

// ── Load the source org ─────────────────────────────────────────────────────
const sourceRows = new Map<(typeof TABLES)[number], Record<string, unknown>[]>();
for (const table of TABLES) {
  const rows = await db
    .select()
    .from(table)
    .where(eq(table.organizationId, SOURCE_ORG));
  sourceRows.set(table, rows as Record<string, unknown>[]);
}

// ── Build the id map: every source row id → fresh uuidv7 ───────────────────
const idMap = new Map<string, string>([[SOURCE_ORG, TARGET_ORG]]);
for (const rows of sourceRows.values()) {
  for (const row of rows) {
    idMap.set(String(row.id).toLowerCase(), Bun.randomUUIDv7());
  }
}

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function remap<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(UUID_RE, (m) => idMap.get(m.toLowerCase()) ?? m) as T;
  }
  if (value instanceof Date || value === null) return value;
  if (Array.isArray(value)) return value.map(remap) as T;
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        remap(entry),
      ]),
    ) as T;
  }
  return value;
}

// ── Copy S3 objects to the target org's prefix ──────────────────────────────
for (const doc of sourceRows.get(shipmentDocuments) ?? []) {
  for (const field of ["storageKey", "previewKey"] as const) {
    const oldKey = doc[field] as string | null;
    if (!oldKey) continue;
    const newKey = remap(oldKey);
    try {
      const body = await BlobStorageService.getObject({ key: oldKey });
      await BlobStorageService.putObject({
        key: newKey,
        body,
        contentType:
          field === "previewKey"
            ? "image/png"
            : (doc.contentType as string) || "application/pdf",
      });
      console.log(`copied s3 object → ${newKey}`);
    } catch (error) {
      console.warn(`WARN: could not copy ${oldKey}: ${error}`);
    }
  }
}

// ── Wipe target org + insert clones, one transaction ───────────────────────
await db.transaction(async (tx) => {
  // Children first; cascades would cover most of this, but be explicit.
  for (const table of [...TABLES].reverse()) {
    await tx.delete(table).where(eq(table.organizationId, TARGET_ORG));
  }

  for (const table of TABLES) {
    const rows = sourceRows.get(table) ?? [];
    if (rows.length === 0) continue;
    const cloned = rows.map((row) => ({
      ...remap(row),
      organizationId: TARGET_ORG,
      userId: TARGET_USER,
    }));
    for (let i = 0; i < cloned.length; i += 100) {
      // biome-ignore lint/suspicious/noExplicitAny: generic row passthrough
      await tx.insert(table).values(cloned.slice(i, i + 100) as any);
    }
  }
});

// ── Verify ──────────────────────────────────────────────────────────────────
for (const table of TABLES) {
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(eq(table.organizationId, TARGET_ORG));
  console.log(
    `${String((table as unknown as { _: { name: string } })._.name ?? "table").padEnd(22)} target rows: ${rows.length} (source: ${sourceRows.get(table)?.length ?? 0})`,
  );
}
process.exit(0);
