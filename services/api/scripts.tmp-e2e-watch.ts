/** Temp: report the line-item E2E state. */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, products, shipmentLineItems, shipments } from "@/db/schema";
const [s] = await db.select().from(shipments).orderBy(desc(shipments.createdAt)).limit(1);
if (!s) { console.log("STATE: no-shipment"); process.exit(0); }
const lines = await db.select().from(shipmentLineItems).where(eq(shipmentLineItems.shipmentId, s.id)).orderBy(shipmentLineItems.lineNumber);
const prods = await db.select().from(products);
const runs = await db.select().from(agentRuns).orderBy(desc(agentRuns.createdAt));
const pendingOrRunning = lines.some(l => l.status === "pending") || runs.some(r => r.status === "running");
console.log("STATE:", s.status === "needs_review" || (lines.length > 0 && !pendingOrRunning && runs.length > 0) ? "done" : "working");
console.log("shipment:", s.id, s.reference, "|", s.stage, "/", s.status, "| dutyCents:", s.dutyCents, "| summary:", JSON.stringify(s.summary).slice(0, 160));
console.log("products:", prods.length, prods.map(p => `${(p.sku ?? p.name.slice(0, 25))}→${p.htsCode ?? "?"}@${p.confidence ?? "-"}[${p.source ?? "-"}]`).join(" | "));
for (const l of lines) console.log(`line ${l.lineNumber}: [${l.status}] ${l.description.slice(0, 45)} | sku:${l.sku} | $${(l.totalValueCents ?? 0) / 100} | hts:${l.htsCode ?? "?"}@${l.confidence ?? "-"} | reused:${l.reusedFromProduct}`);
console.log("agent runs:", runs.length, runs.map(r => `${r.status}(${r.toolCallCount}t)`).join(", "));
process.exit(0);
