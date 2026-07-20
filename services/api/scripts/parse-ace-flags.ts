/**
 * Download CBP's ACE Agency Tariff Code Reference (Pub 0875-0419) and parse
 * its flag-definition table into src/db/reference/pga-flag-definitions.json.
 *
 *   bun run scripts/parse-ace-flags.ts [url-or-local-pdf-path]
 *
 * This document defines what each PGA tariff flag MEANS — agency, program
 * codes, May-vs-Required variant, and disclaim restrictions ("can only be
 * disclaimed using codes A or C"). The per-HTS-code flag assignments come
 * from the per-agency lists ingested by seed-pga-flags.ts; this file is the
 * semantic layer joined onto those rows and fed to the screening agent.
 *
 * cbp.gov 403s non-browser user agents — the fetch below sends a Chrome UA.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PDFiumLibrary } from "@hyzyla/pdfium";

const DEFAULT_URL =
  "https://www.cbp.gov/sites/default/files/2026-03/ace_agency_tariff_codes_04march2026_0.pdf";
const OUT_PATH = resolve(
  __dirname,
  "../src/db/reference/pga-flag-definitions.json",
);

const source = process.argv[2] ?? DEFAULT_URL;

const loadPdf = async (): Promise<Uint8Array> => {
  if (!source.startsWith("http")) {
    return new Uint8Array(await Bun.file(resolve(source)).arrayBuffer());
  }
  const response = await fetch(source, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${source}`);
  }
  return new Uint8Array(await response.arrayBuffer());
};

async function extractLines(): Promise<string[]> {
  const data = await loadPdf();
  const library = await PDFiumLibrary.init();
  const doc = await library.loadDocument(data);
  const lines: string[] = [];
  for (let i = 0; i < doc.getPageCount(); i++) {
    lines.push(...doc.getPage(i).getText().split("\n"));
  }
  doc.destroy();
  return lines;
}

async function main() {
  const lines = await extractLines();

  // Publication metadata from the title page.
  const publishedLine = lines.find((line) =>
    /^\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\s*$/.test(
      line,
    ),
  );
  const pubLine = lines.find((line) => /Pub\s*#/.test(line));
  const publishedAt = publishedLine
    ? new Date(`${publishedLine.trim()} UTC`)
    : null;
  const pubNumber = pubLine?.replace(/.*Pub\s*#\s*/, "").trim() ?? null;
  if (!publishedAt || Number.isNaN(publishedAt.getTime()) || !pubNumber) {
    throw new Error("Could not read publication date / number from the PDF");
  }

interface FlagDefinition {
  flagCode: string;
  agencyCode: string;
  requirement: "may_be_required" | "required";
  programCodes: string[];
  definition: string;
}

// Table rows look like "EP1 EPA M ODS Ozone Depleting Substances …", with
// extra program codes and wrapped definition text on their own lines until
// the next row starts. Everything else (headers, footers, prose) is skipped
// until we're inside the table.
const ROW_START = /^([A-Z]{2}[A-Z0-9])\s+([A-Z]{3,4})\s+(M|R)\s+([A-Z0-9]{2,3})(?:\s+(.*))?$/;
const PROGRAM_CODE = /^[A-Z0-9]{2,3}$/;
const NOISE = [
  /^Tariff$/,
  /^Flag$/,
  /^Code$/,
  /^Agency$/,
  /^R\s*=\s*Required$/,
  /^M\s*=\s*May be$/,
  /^Required$/,
  /^Program$/,
  /^Tariff Flag Code Definition$/,
  /^Ace Agency Tariff Code Reference$/i,
  /^_+\s*$/,
  /ACE Agency Tariff Code Reference\s+P-\d+/,
];

const definitions: FlagDefinition[] = [];
let current: FlagDefinition | null = null;
let inProgramBlock = false;

for (const raw of lines) {
  const line = raw.trim();
  if (!line || NOISE.some((pattern) => pattern.test(line))) continue;

  const start = line.match(ROW_START);
  if (start) {
    const [, flagCode, agencyCode, variant, program, rest] = start;
    current = {
      flagCode: flagCode as string,
      agencyCode: agencyCode as string,
      requirement: variant === "R" ? "required" : "may_be_required",
      programCodes: [program as string],
      definition: rest?.trim() ?? "",
    };
    definitions.push(current);
    inProgramBlock = !current.definition;
    continue;
  }
  if (!current) continue;

  if (inProgramBlock && PROGRAM_CODE.test(line)) {
    current.programCodes.push(line);
    continue;
  }
  inProgramBlock = false;
  current.definition = current.definition
    ? `${current.definition} ${line}`
    : line;
}

if (definitions.length < 30) {
  throw new Error(
    `Parsed only ${definitions.length} flag definitions — layout changed? Inspect the PDF text.`,
  );
}
const malformed = definitions.filter(
  (definition) => !definition.definition || definition.programCodes.length === 0,
);
if (malformed.length > 0) {
  throw new Error(
    `${malformed.length} malformed definitions, e.g. ${JSON.stringify(malformed[0])}`,
  );
}

const output = {
  header: {
    source: "CBP ACE Agency Tariff Code Reference",
    pubNumber,
    publishedAt: publishedAt.toISOString(),
    url: source.startsWith("http") ? source : null,
    parsedAt: new Date().toISOString(),
  },
  definitions,
};

writeFileSync(OUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `Parsed ${definitions.length} flag definitions (${pubNumber}, ${publishedLine?.trim()}) → ${OUT_PATH}`,
);
