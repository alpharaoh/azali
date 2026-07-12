/** Temp: direct classification agent smoke test with a fake dossier. */
import { ShipmentDocumentCategory } from "@/db/schema";
import { ClassificationAgentService } from "@/services/agents/classification/service";
import { db } from "@/db";
import { shipments } from "@/db/schema";

const [realShipment] = await db.select({ id: shipments.id, userId: shipments.userId }).from(shipments).limit(1);
const { result, runId } = await ClassificationAgentService.classify({
  organizationId: "7beb7047-894e-4bf1-8d5f-2598e15a8edd",
  userId: realShipment.userId,
  shipment: {
    id: realShipment.id,
    reference: "SMOKE-1",
    clientName: "TCL North America",
    originCountry: "TW",
    valueCents: 12800000,
  },
  documents: [
    {
      fileName: "commercial-invoice.pdf",
      category: ShipmentDocumentCategory.CommercialInvoice,
      extraction: {
        summary:
          "Commercial invoice from Ningbo Lumina for 2,400 two-packs of the AX5400 tri-band Wi-Fi 6 mesh router (model RBK762), total $128,000, origin Taiwan, FOB Kaohsiung. Supplier declares HS 8517.69.",
        fields: [
          { label: "Product", value: "AX5400 tri-band Wi-Fi 6 mesh router, 2-pack (router + satellite)" },
          { label: "Model", value: "RBK762" },
          { label: "Quantity", value: "2,400 packs" },
          { label: "Total Value", value: "USD 128,000.00" },
          { label: "Country of Origin", value: "Taiwan" },
          { label: "Supplier HS Code", value: "8517.69" },
          { label: "Function", value: "Wireless data transmission/reception, mesh networking, retail packaged" },
        ],
      },
    },
  ],
});

console.log("HTS:", result.htsCode, "| confidence:", result.confidence);
console.log("duty:", JSON.stringify(result.dutyRate));
console.log("GRI path:", result.griPath.map((g) => g.rule).join(" → "));
console.log("notes:", result.notesApplied.map((n) => n.ref).join("; "));
console.log("alternates:", result.alternates.map((a) => `${a.code}@${a.confidence}`).join(", "));
console.log("citations:", result.citations.map((c) => `${c.kind}:${c.ref}`).join(", "));
console.log("overlays:", JSON.stringify(result.overlays));
console.log("runId:", runId);
process.exit(0);
