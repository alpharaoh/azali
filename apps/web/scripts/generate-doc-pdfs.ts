/**
 * Generates a real, openable PDF for every pdf-kind document in the Review Queue
 * seed data, so "View full document" opens the browser's PDF viewer.
 *
 * Run: bun scripts/generate-doc-pdfs.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { REVIEW_OVERVIEW } from "../../../services/api/src/db/seed/data/reviewOverview";
import { docSlug } from "../src/lib/review-types";

/** Helvetica is WinAnsi — transliterate the demo data's typography to ASCII. */
function toAscii(text: string) {
	const map: Record<string, string> = {
		"§": "Sec. ",
		"·": "-",
		"×": "x",
		"Δ": "Delta ",
		"—": "-",
		"–": "-",
		"‘": "'",
		"’": "'",
		"“": '"',
		"”": '"',
		"″": '"',
		"′": "'",
		"↔": "<->",
		"→": "->",
		"Σ": "Sum ",
		"≤": "<=",
		"≥": ">=",
	};

	return text
		.replace(/[§·×Δ—–‘’“”″′↔→Σ≤≥]/g, (char) => map[char] ?? "")
		.normalize("NFKD")
		// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping non-ASCII for PDF strings
		.replace(/[^\x20-\x7e]/g, "");
}

function escapePdfText(text: string) {
	return toAscii(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(text: string, width: number) {
	const words = text.split(" ");
	const lines: string[] = [];
	let current = "";

	for (const word of words) {
		if (current && current.length + word.length + 1 > width) {
			lines.push(current);
			current = word;
		} else {
			current = current ? `${current} ${word}` : word;
		}
	}
	if (current) lines.push(current);

	return lines;
}

function buildPdf(document: {
	name: string;
	meta: string;
	lines: Array<{ label: string; value: string }>;
	note?: string;
}) {
	const ops: string[] = [];
	let y = 740;

	const text = (
		body: string,
		options: { bold?: boolean; gray?: number; size: number; x?: number },
	) => {
		ops.push(
			`BT /${options.bold ? "F2" : "F1"} ${options.size} Tf ${options.gray ?? 0} g ${options.x ?? 72} ${y} Td (${escapePdfText(body)}) Tj ET`,
		);
	};
	const rule = () => {
		ops.push(`0.85 G 0.5 w 72 ${y} m 540 ${y} l S`);
	};

	text(document.name, { bold: true, size: 15 });
	y -= 16;
	text(document.meta, { gray: 0.45, size: 9 });
	y -= 14;
	rule();
	y -= 24;

	for (const line of document.lines) {
		text(line.label, { gray: 0.45, size: 9.5 });
		text(line.value, { bold: true, size: 10, x: 250 });
		y -= 22;
	}

	if (document.note) {
		y -= 8;
		rule();
		y -= 18;
		text("Note", { bold: true, gray: 0.45, size: 8.5 });
		y -= 13;
		for (const noteLine of wrap(toAscii(document.note), 95)) {
			text(noteLine, { gray: 0.3, size: 9 });
			y -= 12;
		}
	}

	y = 56;
	rule();
	y -= 14;
	text("Azali - AI Customs Brokerage - reconstructed document preview", {
		gray: 0.55,
		size: 7.5,
	});

	const stream = ops.join("\n");
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
		`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
	];

	let pdf = "%PDF-1.4\n";
	const offsets: number[] = [];

	objects.forEach((body, index) => {
		offsets.push(pdf.length);
		pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
	});

	const xrefStart = pdf.length;

	pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (const offset of offsets) {
		pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
	}
	pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

	return pdf;
}

const outDir = join(new URL(".", import.meta.url).pathname, "../public/docs");

mkdirSync(outDir, { recursive: true });

let count = 0;

for (const item of Object.values(REVIEW_OVERVIEW)) {
	for (const document of item.documents) {
		if (document.kind !== "pdf") continue;
		const path = join(outDir, `${docSlug(document.name)}.pdf`);

		writeFileSync(path, buildPdf(document), "latin1");
		count += 1;
		console.log(`  ${docSlug(document.name)}.pdf`);
	}
}

console.log(`Generated ${count} PDFs in public/docs/`);
