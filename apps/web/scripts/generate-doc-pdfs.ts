/**
 * Generates professional-looking PDFs for every pdf-kind document in the
 * Review Queue seed data by rendering HTML templates through headless Chrome.
 *
 * Three layouts:
 *  - invoice:      boxed commercial-invoice form (seller/sold-to/ship-to,
 *                  line-item table, totals block, certifications) modeled on
 *                  the real Azali invoice template
 *  - packing list: exporter/consignee form with a packages/units/weight table
 *  - generic:      letterhead + field table built from the doc's seeded lines
 *
 * Documents with a real `src` file are skipped. Run: bun scripts/generate-doc-pdfs.ts
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { REVIEW_OVERVIEW } from "../../../services/api/src/db/seed/data/reviewOverview";
import { docSlug } from "../src/lib/review-types";

const CHROME =
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const outDir = new URL("../public/docs", import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

/* -------------------------------------------------------------------------------------------------
 * Shared styles
 * -----------------------------------------------------------------------------------------------*/
const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 9.5px; padding: 34px 38px; }
  .title { text-align: center; font-size: 17px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 14px; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #444; padding: 5px 7px; vertical-align: top; }
  .lbl { font-size: 7px; font-style: italic; color: #555; text-transform: uppercase; letter-spacing: 0.3px; display: block; margin-bottom: 2px; }
  .val { font-size: 9.5px; }
  .head th { background: #efefef; font-size: 7.5px; font-style: italic; text-transform: uppercase; letter-spacing: 0.3px; color: #333; text-align: left; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .tot { font-weight: 700; }
  .muted { color: #666; }
  .sig { margin-top: 6px; font-family: 'Snell Roundhand', cursive; font-size: 14px; }
  .small { font-size: 8px; color: #444; line-height: 1.45; }
  .foot { margin-top: 14px; font-size: 7.5px; color: #888; display: flex; justify-content: space-between; }
`;

const page = (body: string) =>
	`<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body>${body}</body></html>`;

const esc = (value: string) =>
	value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* -------------------------------------------------------------------------------------------------
 * Invoice template
 * -----------------------------------------------------------------------------------------------*/
interface InvoiceSpec {
	kind: "invoice";
	invoiceNo: string;
	invoiceDate: string;
	reference: string;
	refDate: string;
	seller: string[];
	soldTo: string[];
	shipTo: string[];
	termsSale: string;
	termsPay: string;
	mode: string;
	bol: string;
	lines: Array<{ qty: string; desc: string; hts: string; uom: string; unit: string }>;
	continuation?: string;
	marks: string[];
	totals: Array<{ label: string; value: string; bold?: boolean }>;
	certifications: string;
	signer: string;
}

function invoiceHtml(spec: InvoiceSpec) {
	const box = (label: string, lines: string[]) =>
		`<span class="lbl">${label}</span><div class="val">${lines.map(esc).join("<br>")}</div>`;
	const cell = (label: string, value: string) =>
		`<span class="lbl">${label}</span><div class="val">${esc(value)}</div>`;

	return page(`
    <div class="title">COMMERCIAL INVOICE</div>
    <table>
      <tr>
        <td style="width:52%">${box("Seller", spec.seller)}</td>
        <td style="width:26%">${cell("Invoice number", spec.invoiceNo)}</td>
        <td style="width:22%">${cell("Date", spec.invoiceDate)}</td>
      </tr>
      <tr>
        <td rowspan="2">${box("Sold to", spec.soldTo)}</td>
        <td>${cell("Customer reference number", spec.reference)}</td>
        <td>${cell("Date", spec.refDate)}</td>
      </tr>
      <tr><td colspan="2">${cell("Terms of sale", spec.termsSale)}</td></tr>
      <tr>
        <td rowspan="2">${box("Ship to", spec.shipTo)}</td>
        <td colspan="2">${cell("Terms of payment", spec.termsPay)}</td>
      </tr>
      <tr>
        <td>${cell("Mode of shipment", spec.mode)}</td>
        <td>${cell("Bill of lading / AWB", spec.bol)}</td>
      </tr>
    </table>
    <table style="margin-top:8px">
      <tr class="head">
        <th style="width:9%">Qty</th>
        <th>Product description and harmonized code</th>
        <th style="width:10%">Unit of measure</th>
        <th style="width:11%">Unit price</th>
      </tr>
      ${spec.lines
				.map(
					(line) => `<tr>
        <td class="num">${esc(line.qty)}</td>
        <td>${esc(line.desc)}<br><span class="muted" style="font-style:italic">${esc(line.hts)}</span></td>
        <td>${esc(line.uom)}</td>
        <td class="num">${esc(line.unit)}</td>
      </tr>`,
				)
				.join("")}
      ${spec.continuation ? `<tr><td colspan="4" class="muted" style="font-style:italic">${esc(spec.continuation)}</td></tr>` : ""}
    </table>
    <table style="margin-top:8px">
      <tr>
        <td rowspan="${spec.totals.length}" style="width:52%">${box("Package marks", spec.marks)}</td>
        ${spec.totals
					.map(
						(total, index) =>
							`${index === 0 ? "" : "<tr>"}<td style="width:30%"><span class="lbl">${esc(total.label)}</span></td><td class="num ${total.bold ? "tot" : ""}" style="width:18%">${esc(total.value)}</td></tr>`,
					)
					.join("")}
    </table>
    <table style="margin-top:8px">
      <tr>
        <td style="width:52%"><span class="lbl">Certifications</span><div class="small">${esc(spec.certifications)}</div></td>
        <td><span class="lbl">I certify that the stated export prices and description of goods are true and correct</span>
          <div class="sig">${esc(spec.signer)}</div>
          <div class="small">SIGNED &nbsp; ${esc(spec.signer)}</div>
        </td>
      </tr>
    </table>
  `);
}

/* -------------------------------------------------------------------------------------------------
 * Packing list template
 * -----------------------------------------------------------------------------------------------*/
interface PackingSpec {
	kind: "packing";
	exporter: string[];
	consignee: string[];
	shipDate: string;
	tracking: string;
	invoiceNo: string;
	po: string;
	packageType: string;
	instructions: string;
	lines: Array<{ pkgs: string; units: string; weight: string; uom: string; desc: string; origin: string }>;
	totals: { pkgs: string; units: string; net: string; gross: string };
	signer: string;
}

function packingHtml(spec: PackingSpec) {
	const box = (label: string, lines: string[]) =>
		`<span class="lbl">${label}</span><div class="val">${lines.map(esc).join("<br>")}</div>`;
	const cell = (label: string, value: string) =>
		`<span class="lbl">${label}</span><div class="val">${esc(value)}</div>`;

	return page(`
    <div class="title">PACKING LIST</div>
    <table>
      <tr>
        <td rowspan="2" style="width:52%">${box("Exporter", spec.exporter)}</td>
        <td>${cell("Ship date", spec.shipDate)}</td>
        <td>${cell("Air waybill / tracking no.", spec.tracking)}</td>
      </tr>
      <tr>
        <td>${cell("Invoice no.", spec.invoiceNo)}</td>
        <td>${cell("Purchase order no.", spec.po)}</td>
      </tr>
      <tr>
        <td rowspan="2">${box("Consignee", spec.consignee)}</td>
        <td colspan="2">${cell("Package type", spec.packageType)}</td>
      </tr>
      <tr><td colspan="2"><span class="lbl">Special instructions</span><div class="small">${esc(spec.instructions)}</div></td></tr>
    </table>
    <table style="margin-top:8px">
      <tr class="head">
        <th style="width:9%">No. of packages</th>
        <th style="width:9%">No. of units</th>
        <th style="width:11%">Net weight (kgs)</th>
        <th style="width:8%">Unit of measure</th>
        <th>Description of goods (part #, serial #, etc.)</th>
        <th style="width:9%">Country of MFR</th>
      </tr>
      ${spec.lines
				.map(
					(line) => `<tr>
        <td class="num">${esc(line.pkgs)}</td><td class="num">${esc(line.units)}</td>
        <td class="num">${esc(line.weight)}</td><td>${esc(line.uom)}</td>
        <td>${esc(line.desc)}</td><td>${esc(line.origin)}</td>
      </tr>`,
				)
				.join("")}
      <tr class="tot">
        <td class="num">${esc(spec.totals.pkgs)}</td>
        <td class="num">${esc(spec.totals.units)}</td>
        <td class="num">${esc(spec.totals.net)}</td>
        <td>KGS</td>
        <td colspan="2">Total gross weight: ${esc(spec.totals.gross)}</td>
      </tr>
    </table>
    <table style="margin-top:8px"><tr><td>
      <div class="small">I declare that all the information contained in this packing list is true and correct.</div>
      <div class="sig">${esc(spec.signer)}</div>
      <div class="small">${esc(spec.signer)}</div>
    </td></tr></table>
  `);
}

/* -------------------------------------------------------------------------------------------------
 * Generic letterhead form — built from the document's seeded lines
 * -----------------------------------------------------------------------------------------------*/
function genericHtml(doc: {
	name: string;
	meta: string;
	lines: Array<{ label: string; value: string; highlight?: boolean }>;
}) {
	const issuer = doc.meta.split("·")[0]?.trim() ?? "";

	return page(`
    <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #1a1a1a;padding-bottom:8px;margin-bottom:16px">
      <span style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">${esc(issuer)}</span>
      <span class="muted" style="font-size:8px">${esc(doc.meta)}</span>
    </div>
    <div class="title" style="text-align:left;font-size:14px;margin-bottom:14px">${esc(doc.name)}</div>
    <table>
      ${doc.lines
				.map(
					(line) => `<tr${line.highlight ? ' style="background:#f3f3f3"' : ""}>
        <td style="width:32%;border-color:#999"><span class="lbl" style="margin:0">${esc(line.label)}</span></td>
        <td style="border-color:#999" class="val ${line.highlight ? "tot" : ""}">${esc(line.value)}</td>
      </tr>`,
				)
				.join("")}
    </table>
    <div class="foot"><span>${esc(doc.name)}</span><span>Page 1 of 1</span></div>
  `);
}

/* -------------------------------------------------------------------------------------------------
 * Hand-authored specs for the documents that carry the demo
 * -----------------------------------------------------------------------------------------------*/
const SPECS: Record<string, InvoiceSpec | PackingSpec> = {
	"Commercial Invoice PRI-3301": {
		kind: "invoice",
		invoiceNo: "PRI-3301",
		invoiceDate: "12 Jun 2026",
		reference: "PO-77841",
		refDate: "28 May 2026",
		seller: ["Shenzhen Kaida Trading Co., Ltd.", "Bldg 7, Futian Free Trade Zone", "Shenzhen, Guangdong 518038, China", "Tel: +86 755 8830 1122"],
		soldTo: ["Pacific Rim Imports LLC", "2300 Alameda Street", "Los Angeles, CA 90058, USA", "IRS/EIN: 36-4821997"],
		shipTo: ["Pacific Rim Imports — LA DC", "14801 S. Broadway", "Gardena, CA 90248", "Port of Entry: LA/Long Beach (2704)"],
		termsSale: "FOB Shanghai (Incoterms 2020)",
		termsPay: "Net 45 days from B/L date",
		mode: "Ocean — COSCO Harmony 112E",
		bol: "COSU7719402113",
		lines: [
			{ qty: "4,100", desc: "Smart electric kettle SK-8, 1.7L, retail boxed", hts: "HTS 8516.71.0020 — electrothermic appliances", uom: "PCE", unit: "16.40" },
			{ qty: "2,850", desc: "LED desk lamp DL-12, aluminum, USB-C", hts: "HTS 9405.20.6010 — electric table lamps", uom: "PCE", unit: "11.20" },
			{ qty: "2,400", desc: "Cordless hand blender HB-3, 200W", hts: "HTS 8509.40.0025 — food mixers/blenders", uom: "PCE", unit: "9.85" },
			{ qty: "1,900", desc: "Bamboo-pattern storage bin set (3), polypropylene", hts: "HTS 3924.90.5650 — household articles of plastic", uom: "SET", unit: "6.10" },
			{ qty: "1,750", desc: "Swivel bar stool frame BS-9, steel/PU", hts: "HTS 9401.79.0015 — seats with metal frames", uom: "PCE", unit: "14.60" },
			{ qty: "1,600", desc: "Digital kitchen scale KS-2, 5kg, glass", hts: "HTS 8423.10.0010 — personal/household scales", uom: "PCE", unit: "5.35" },
			{ qty: "1,450", desc: "Ultrasonic aroma diffuser AD-6, 300ml", hts: "HTS 8509.80.5095 — electromechanical appliances", uom: "PCE", unit: "7.20" },
			{ qty: "1,200", desc: "Foldable laundry hamper, PP frame, fabric", hts: "HTS 3924.90.1050 — household articles of plastic", uom: "PCE", unit: "3.95" },
		],
		continuation: "… 16 additional line items — see pages 2–5. 24 lines total.",
		marks: ["PACIFIC RIM / LA", "C/NO 1-480  MADE IN CHINA", "480 cartons / 1 x 40' HC", "G.W. 6,480 kg  N.W. 6,230 kg"],
		totals: [
			{ label: "Total commercial value", value: "USD 185,210.00" },
			{ label: "Misc charges (packing)", value: "USD 1,190.00" },
			{ label: "Total invoice value", value: "USD 186,400.00", bold: true },
		],
		certifications: "These commodities are licensed for ultimate destination USA. Country of origin: China. Diversion contrary to U.S. law prohibited. ECCN: EAR99.",
		signer: "Li Wen",
	},
	"Commercial Invoice INV-88231": {
		kind: "invoice",
		invoiceNo: "INV-88231",
		invoiceDate: "05 Jul 2026",
		reference: "PO-55102",
		refDate: "18 Jun 2026",
		seller: ["Nestlé Suisse S.A.", "Entre-deux-Villes 10", "1800 Vevey, Switzerland", "Tel: +41 21 924 1111"],
		soldTo: ["Nestlé USA, Inc.", "1812 N. Moore Street", "Arlington, VA 22209, USA", "IRS/EIN: 95-1610229"],
		shipTo: ["Nestlé USA — NJ Distribution", "One Meadowlands Plaza", "East Rutherford, NJ 07073", "Port of Entry: New York/Newark (1001)"],
		termsSale: "CIF New York (Incoterms 2020)",
		termsPay: "Net 30 days from invoice date",
		mode: "Ocean — Maersk Essen 031W",
		bol: "MAEU556677121",
		lines: [
			{ qty: "320", desc: "Instant cocoa beverage preparation, 24×400g cases", hts: "HTS 1806.90.5500 — cocoa preparations", uom: "CS", unit: "12.50" },
			{ qty: "450", desc: "Malted milk drink base, 12×900g cases", hts: "HTS 1901.90.9195 — food preparations of malt extract", uom: "CS", unit: "8.00" },
			{ qty: "500", desc: "Instant coffee, freeze-dried, 6×200g jars", hts: "HTS 2101.11.2129 — instant coffee, not decaffeinated", uom: "CS", unit: "6.20" },
			{ qty: "1,800", desc: "Culinary bouillon tablets, 24×8-pack cases", hts: "HTS 2104.10.0020 — soups and broths, dry", uom: "CS", unit: "9.10" },
			{ qty: "240", desc: "Hazelnut spread, 12×725g cases", hts: "HTS 1806.90.9019 — cocoa preparations nesoi", uom: "CS", unit: "10.25" },
			{ qty: "380", desc: "Condensed milk, sweetened, 48×397g cases", hts: "HTS 0402.99.4500 — condensed milk, sweetened", uom: "CS", unit: "5.50" },
			{ qty: "200", desc: "Espresso capsules, aluminum, 10×100 cases", hts: "HTS 0901.21.0035 — roasted coffee, not decaf", uom: "CS", unit: "14.80" },
			{ qty: "160", desc: "Baking chocolate couverture, 8×2.5kg cases", hts: "HTS 1806.20.9895 — chocolate preparations, bulk", uom: "CS", unit: "9.75" },
			{ qty: "300", desc: "Powdered coffee creamer, 24×450g cases", hts: "HTS 2106.90.9998 — food preparations nesoi", uom: "CS", unit: "7.40" },
			{ qty: "275", desc: "Infant cereal, wheat, 12×500g cases", hts: "HTS 1901.10.1600 — infant food preparations", uom: "CS", unit: "8.40" },
			{ qty: "420", desc: "Seasoning sauce, 24×250ml cases", hts: "HTS 2103.90.9091 — mixed condiments nesoi", uom: "CS", unit: "6.50" },
			{ qty: "200", desc: "Cocoa powder, unsweetened, 12×1kg cases", hts: "HTS 1805.00.0000 — cocoa powder, unsweetened", uom: "CS", unit: "11.85" },
		],
		marks: ["NESTLÉ / EAST RUTHERFORD NJ", "C/NO 1-310  PRODUCT OF SWITZERLAND", "310 cartons / 1 x 20' reefer", "G.W. 8,650 kg  N.W. 7,940 kg"],
		totals: [
			{ label: "Total commercial value", value: "USD 47,610.00" },
			{ label: "Misc charges (insurance, freight)", value: "USD 640.00" },
			{ label: "Total invoice value", value: "USD 48,250.00", bold: true },
		],
		certifications: "Country of origin: Switzerland. Products conform to FDA registration on file. Lot codes per packing list.",
		signer: "M. Keller",
	},
	"Commercial Invoice BW-5540": {
		kind: "invoice",
		invoiceNo: "BW-5540",
		invoiceDate: "01 Jul 2026",
		reference: "PO-66018",
		refDate: "12 Jun 2026",
		seller: ["Bluewave Electronics Co., Ltd.", "No. 88 Chenggong Road, Qianzhen District", "Kaohsiung 806, Taiwan", "Tel: +886 7 555 0188"],
		soldTo: ["TCL North America", "1860 Compton Avenue", "Corona, CA 92881, USA", "IRS/EIN: 33-0941102"],
		shipTo: ["TCL — West Coast DC", "21600 Alameda Street", "Carson, CA 90810", "Port of Entry: LA/Long Beach (2704)"],
		termsSale: "FOB Kaohsiung (Incoterms 2020)",
		termsPay: "Net 30 days from B/L date",
		mode: "Ocean — OOCL Tokyo 084E",
		bol: "OOLU2247719305",
		lines: [
			{ qty: "500", desc: "USB-C to USB-C cable, 2m, braided, retail packed", hts: "HTS 8544.42.2000 — insulated conductors, fitted with connectors", uom: "SET", unit: "12.40" },
			{ qty: "400", desc: "Mesh Wi-Fi range extender EX-3, dual-band", hts: "HTS 8517.62.0090 — machines for reception/transmission of data", uom: "PCE", unit: "37.00" },
			{ qty: "2,400", desc: "AX5400 tri-band mesh Wi-Fi 6 router, 2-pack (RBK762), retail boxed", hts: "HTS: under classification review — see broker", uom: "PK", unit: "53.33" },
		],
		marks: ["TCL / CARSON CA", "C/NO 1-265  MADE IN TAIWAN", "265 cartons / 1 x 20' FCL", "G.W. 4,180 kg  N.W. 3,720 kg"],
		totals: [
			{ label: "Total commercial value", value: "USD 148,992.00" },
			{ label: "Rounding / misc charges", value: "USD 8.00" },
			{ label: "Total invoice value", value: "USD 149,000.00", bold: true },
		],
		certifications: "Country of origin: Taiwan. These commodities are licensed for ultimate destination USA. ECCN: 5A992.c (mass market).",
		signer: "C. Huang",
	},
	"Commercial Invoice INV-4471": {
		kind: "invoice",
		invoiceNo: "INV-4471",
		invoiceDate: "27 Jun 2026",
		reference: "IC-PO-2026-118 (intercompany)",
		refDate: "02 Jun 2026",
		seller: ["Bosch Fertigung GmbH", "Robert-Bosch-Platz 1", "70839 Gerlingen, Germany", "Related party: parent company"],
		soldTo: ["Robert Bosch LLC", "38000 Hills Tech Drive", "Farmington Hills, MI 48331, USA", "IRS/EIN: 38-1345670"],
		shipTo: ["Robert Bosch — Charleston Plant", "8101 Dorchester Road", "North Charleston, SC 29418", "Port of Entry: Savannah (1703)"],
		termsSale: "FCA Hamburg (Incoterms 2020)",
		termsPay: "Intercompany settlement — monthly netting",
		mode: "Ocean — Hapag Hamburg Express 077W",
		bol: "HLCUHAM260627441",
		lines: [
			{ qty: "11,000", desc: "Sensor housing RW-4471, machined aluminum, anodized", hts: "HTS 8409.91.5085 — parts for spark-ignition engines", uom: "PCE", unit: "8.40" },
			{ qty: "40", desc: "Returnable steel transport racks (no charge, re-export)", hts: "HTS 9803.00.50 — instruments of international traffic", uom: "PCE", unit: "0.00" },
		],
		marks: ["BOSCH / N. CHARLESTON SC", "C/NO 1-92  MADE IN GERMANY", "92 crates / 2 x 20' FCL", "G.W. 14,900 kg  N.W. 13,750 kg"],
		totals: [
			{ label: "Total commercial value", value: "USD 92,400.00" },
			{ label: "Misc charges", value: "USD 0.00" },
			{ label: "Total invoice value", value: "USD 92,400.00", bold: true },
		],
		certifications: "Country of origin: Germany. Buyer and seller are related parties within the meaning of 19 CFR 152.102(g); price reviewed under the transfer pricing policy on file.",
		signer: "A. Vogel",
	},
	"Commercial Invoice INV-7702": {
		kind: "invoice",
		invoiceNo: "INV-7702",
		invoiceDate: "30 Jun 2026",
		reference: "PO-90233",
		refDate: "05 Jun 2026",
		seller: ["Rheinwerk Präzision GmbH", "Königstraße 44", "70173 Stuttgart, Germany", "Tel: +49 711 550 8800"],
		soldTo: ["Siemens Industry, Inc.", "100 Technology Drive", "Alpharetta, GA 30005, USA", "IRS/EIN: 23-1682775"],
		shipTo: ["Siemens — Houston Service Center", "7000 Hollister Street", "Houston, TX 77040", "Port of Entry: Houston (5301)"],
		termsSale: "CIP Houston (Incoterms 2020)",
		termsPay: "Net 60 days from invoice date",
		mode: "Ocean — MSC Gülsün 118W",
		bol: "MEDUHH448211976",
		lines: [
			{ qty: "140", desc: "Precision spindle RW-2205, ground, matched bearing set", hts: "HTS 8466.93.5385 — parts for metalworking machine tools", uom: "PCE", unit: "1,026.43" },
		],
		marks: ["SIEMENS / HOUSTON TX", "C/NO 1-35  COUNTRY OF ORIGIN: ______", "35 crates / 1 x 20' FCL", "G.W. 5,900 kg  N.W. 5,320 kg"],
		totals: [
			{ label: "Total commercial value", value: "USD 143,700.00" },
			{ label: "Misc charges (insurance, carriage)", value: "USD 0.00 (CIP)" },
			{ label: "Total invoice value", value: "USD 143,700.00", bold: true },
		],
		certifications: "Country of origin: ______ (field not completed by shipper — see manufacturer's declaration). Commodities licensed for ultimate destination USA.",
		signer: "K. Brandt",
	},
	"Packing List — PRI-3301": {
		kind: "packing",
		exporter: ["Shenzhen Kaida Trading Co., Ltd.", "Bldg 7, Futian Free Trade Zone", "Shenzhen, Guangdong 518038, China"],
		consignee: ["Pacific Rim Imports LLC", "2300 Alameda Street", "Los Angeles, CA 90058, USA"],
		shipDate: "14 Jun 2026",
		tracking: "COSU7719402113",
		invoiceNo: "PRI-3301",
		po: "PO-77841",
		packageType: "Cartons (1 x 40' HC, floor-loaded)",
		instructions: "Port of Entry: LA/Long Beach (2704). Mixed housewares consolidation — 24 invoice lines across Chapters 85, 94, and 39. Keep dry.",
		lines: [
			{ pkgs: "260", units: "9,800", weight: "3,900", uom: "PCE", desc: "Small electric appliances (kettles, blenders, scales, diffusers) — Ch. 85 lines", origin: "CN" },
			{ pkgs: "150", units: "5,740", weight: "1,850", uom: "PCE", desc: "Lamps and seating components — Ch. 94 lines", origin: "CN" },
			{ pkgs: "70", units: "2,800", weight: "480", uom: "PCE", desc: "Plastic household articles — Ch. 39 lines", origin: "CN" },
		],
		totals: { pkgs: "480", units: "18,340", net: "6,230", gross: "6,480 kg" },
		signer: "Li Wen / Export Dept · 14 Jun 2026",
	},
	"Packing List PL-88231": {
		kind: "packing",
		exporter: ["Nestlé Suisse S.A.", "Entre-deux-Villes 10", "1800 Vevey, Switzerland"],
		consignee: ["Nestlé USA, Inc.", "One Meadowlands Plaza", "East Rutherford, NJ 07073, USA"],
		shipDate: "06 Jul 2026",
		tracking: "MAEU556677121",
		invoiceNo: "INV-88231",
		po: "PO-55102",
		packageType: "Cartons (1 x 20' reefer, +14°C)",
		instructions: "Port of Entry: New York/Newark (1001). Foodstuffs — FDA prior notice filed. Quantities and unit prices correspond to invoice lines 1–12.",
		lines: [
			{ pkgs: "96", units: "2,070", weight: "2,610", uom: "CS", desc: "Beverage preparations (cocoa, malt, coffee) — lines 1–3, 7, 12", origin: "CH" },
			{ pkgs: "124", units: "2,180", weight: "3,320", uom: "CS", desc: "Culinary (bouillon, sauces, broths) — lines 4, 11", origin: "CH" },
			{ pkgs: "58", units: "780", weight: "1,240", uom: "CS", desc: "Dairy & spreads (condensed milk, hazelnut spread) — lines 5–6", origin: "CH" },
			{ pkgs: "32", units: "935", weight: "770", uom: "CS", desc: "Baking & infant (couverture, creamer, cereal) — lines 8–10", origin: "CH" },
		],
		totals: { pkgs: "310", units: "5,965", net: "7,940", gross: "8,650 kg" },
		signer: "M. Keller / Logistics · 06 Jul 2026",
	},
};

/* -------------------------------------------------------------------------------------------------
 * Render
 * -----------------------------------------------------------------------------------------------*/
const tmp = mkdtempSync(join(tmpdir(), "azali-docs-"));
let count = 0;

for (const item of Object.values(REVIEW_OVERVIEW)) {
	for (const document of item.documents) {
		if (document.kind !== "pdf") continue;
		// Documents backed by a real PDF file (src) don't need a generated one.
		if (document.src) continue;
		// Rationale memos never render as documents (they open in the editor).
		if (/rationale memo/i.test(document.name)) continue;

		const spec = SPECS[document.name];
		const html =
			spec?.kind === "invoice"
				? invoiceHtml(spec)
				: spec?.kind === "packing"
					? packingHtml(spec)
					: genericHtml(document);

		const slug = docSlug(document.name);
		const htmlPath = join(tmp, `${slug}.html`);
		writeFileSync(htmlPath, html);
		execFileSync(CHROME, [
			"--headless=new",
			"--disable-gpu",
			"--no-pdf-header-footer",
			`--print-to-pdf=${join(outDir, `${slug}.pdf`)}`,
			`file://${htmlPath}`,
		]);
		count += 1;
		console.log(`  ${slug}.pdf${spec ? ` (${spec.kind})` : ""}`);
	}
}

rmSync(tmp, { recursive: true, force: true });
console.log(`Generated ${count} PDFs in public/docs/`);
