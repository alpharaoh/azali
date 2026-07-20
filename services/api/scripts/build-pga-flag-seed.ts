/**
 * Compile the per-agency HTS→flag source lists into the seed the flag table
 * imports (src/db/reference/pga-flags.json).
 *
 *   bun run scripts/build-pga-flag-seed.ts
 *
 * CBP distributes the complete HTS→flag cross-reference only to ABI filers;
 * publicly, each agency publishes its own slice. The checked-in sources
 * (src/db/reference/sources/) are the verified, machine-readable ones:
 *
 * - aphis-core-2026-02.csv    — APHIS Core Correlation Table (AQ1/AQ2 as
 *                               published; "flag not enforced" rows skipped)
 * - lacey-act-schedule.csv    — Lacey Act implementation schedule → AL1
 * - nmfs-trade-monitoring-2026-07.csv — NMFS programs → NM1/NM3/NM5/NM8
 * - dea-drug-codes-2026-03.csv — DEA drug codes → DE1, pill machines → DE3
 *
 * KNOWN GAP: FDA publishes no machine-readable FD1–FD4 list (their mapping
 * ships only in the ABI HTS extract). FDA coverage relies on the screening
 * agent's jurisdiction sweep until a filer-sourced list is obtained.
 *
 * Flag variants (may-be-required vs required) come from the parsed ACE
 * Agency Tariff Code Reference (pga-flag-definitions.json) — never guessed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REFERENCE_DIR = resolve(__dirname, "../src/db/reference");
const SOURCES_DIR = resolve(REFERENCE_DIR, "sources");
const OUT_PATH = resolve(REFERENCE_DIR, "pga-flags.json");

interface SeedFlag {
  htsPrefix: string;
  agencyCode: string;
  flagCode: string;
  requirement: string;
  programDescription: string;
}

/** Quote-aware CSV → array of records keyed by header. */
function parseCsv(path: string): Array<Record<string, string>> {
  const text = readFileSync(path, "utf8");
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i] as string;
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((cells) =>
    Object.fromEntries(
      header.map((column, index) => [column.trim(), cells[index]?.trim() ?? ""]),
    ),
  );
}

/** Digits only; valid prefixes are even-length, 2–10 digits. */
function normalizePrefix(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 2 || digits.length > 10 || digits.length % 2 !== 0) {
    return null;
  }
  return digits;
}

// The flag variants come from the parsed CBP publication — the single
// authority on what each flag code means.
const definitionsFile = JSON.parse(
  readFileSync(resolve(REFERENCE_DIR, "pga-flag-definitions.json"), "utf8"),
) as {
  definitions: Array<{
    flagCode: string;
    agencyCode: string;
    requirement: string;
  }>;
};
const definitionByFlag = new Map(
  definitionsFile.definitions.map((definition) => [
    definition.flagCode,
    definition,
  ]),
);

function makeFlag(
  rawHts: string,
  flagCode: string,
  programDescription: string,
  skipped: string[],
): SeedFlag | null {
  const htsPrefix = normalizePrefix(rawHts);
  if (!htsPrefix) {
    skipped.push(rawHts);
    return null;
  }
  const definition = definitionByFlag.get(flagCode);
  if (!definition) {
    throw new Error(`Flag ${flagCode} missing from pga-flag-definitions.json`);
  }
  return {
    htsPrefix,
    agencyCode: definition.agencyCode,
    flagCode,
    requirement: definition.requirement,
    programDescription,
  };
}

const flags: SeedFlag[] = [];
const skipped: string[] = [];

// --- APHIS Core: the flag column is authoritative (AQ1/AQ2). -------------
for (const record of parseCsv(resolve(SOURCES_DIR, "aphis-core-2026-02.csv"))) {
  const flagCode = record["APHIS Flag"] ?? "";
  if (!/^AQ[12X]$/.test(flagCode)) continue; // "flag not enforced"
  const flag = makeFlag(
    record["10 digit HTS"] ?? "",
    flagCode,
    `APHIS Core (${record["APHIS Operational Program"] || "APHIS"}) — ${
      record["APHIS Primary Category Type"] || record["APHIS Flag Description"] || ""
    }`.trim(),
    skipped,
  );
  if (flag) flags.push(flag);
}

// --- APHIS Lacey Act: scheduled codes carry AL1 (declaration may be
// required — not every article under a code contains plant material). -----
for (const record of parseCsv(resolve(SOURCES_DIR, "lacey-act-schedule.csv"))) {
  const flag = makeFlag(
    record.Heading ?? "",
    "AL1",
    `Lacey Act declaration — ${record["Article/Component of Article"] || "scheduled article"} (phase effective ${record["Effective Date"] || "n/a"})`,
    skipped,
  );
  if (flag) flags.push(flag);
}

// --- NMFS: program → flag. SIMP is the mandatory program (NM8); the
// others are may-be-required variants resolved per shipment. --------------
const NMFS_PROGRAM_FLAGS: Record<string, string> = {
  AMLR: "NM3",
  HMS: "NM5",
  SIMP: "NM8",
  TTVP: "NM1",
};
for (const record of parseCsv(
  resolve(SOURCES_DIR, "nmfs-trade-monitoring-2026-07.csv"),
)) {
  const programs = (record.program ?? "")
    .split(/[,/]/)
    .map((value) => value.trim().replace(/\*+$/, ""))
    .filter(Boolean);
  for (const program of programs) {
    const flagCode = NMFS_PROGRAM_FLAGS[program];
    if (!flagCode) {
      skipped.push(`${record.htsCode} (unknown NMFS program ${program})`);
      continue;
    }
    const flag = makeFlag(
      record.htsCode ?? "",
      flagCode,
      `NMFS ${program} — ${record.species || record.description || ""}`.trim(),
      skipped,
    );
    if (flag) flags.push(flag);
  }
}

// --- DEA: drug codes → DE1, pill machines → DE3 (both may-be-required). --
for (const record of parseCsv(
  resolve(SOURCES_DIR, "dea-drug-codes-2026-03.csv"),
)) {
  const flag = makeFlag(
    record.htsCode ?? "",
    record.program === "MAC" ? "DE3" : "DE1",
    record.program === "MAC"
      ? `DEA regulated machine — ${record.description || ""}`.trim()
      : `DEA controlled substances / listed chemicals — ${record.description || ""}`.trim(),
    skipped,
  );
  if (flag) flags.push(flag);
}

// Dedupe on the (htsPrefix, flagCode) pair — sources can repeat a code.
const seen = new Set<string>();
const deduped = flags.filter((flag) => {
  const key = `${flag.htsPrefix}:${flag.flagCode}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const byAgency = deduped.reduce<Record<string, number>>((counts, flag) => {
  counts[flag.agencyCode] = (counts[flag.agencyCode] ?? 0) + 1;
  return counts;
}, {});

const output = {
  header: {
    source:
      "Composite of published agency ACE flag lists: APHIS Core Correlation Table (Feb 10, 2026), APHIS Lacey Act schedule, NMFS Trade Monitoring HTS list (Jul 2026), DEA drug-code reference (Mar 2026, CBP Pub). Flag semantics per CBP ACE Agency Tariff Code Reference 0875-0419 (Mar 4, 2026). FDA FD1–FD4 not included — no public machine-readable list exists.",
    pubNumber: "azali-composite-2026-07",
    publishedAt: "2026-07-19T00:00:00.000Z",
  },
  flags: deduped,
};

writeFileSync(OUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `Wrote ${deduped.length} flag rows (${flags.length - deduped.length} duplicates dropped, ${skipped.length} rows skipped) → ${OUT_PATH}`,
);
console.log("By agency:", byAgency);
if (skipped.length) {
  console.log("Skipped (non-parseable HTS):", skipped.slice(0, 10));
}
