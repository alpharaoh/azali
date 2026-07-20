/**
 * Seed the PGA flag reference tables from a parsed HTS→flag JSON.
 *
 *   bun run scripts/seed-pga-flags.ts [path/to/pga-flags.json]
 *
 * Idempotent per publication: re-running with the same pubNumber+publishedAt
 * is a no-op; a newer publication becomes a new version and takes over the
 * `active` pointer atomically. Old versions are never mutated — historical
 * screenings keep citing the exact publication they ran against.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "@/db";
import { insertPgaFlags } from "@/db/queries/insert/insertPgaFlags";
import { insertPgaFlagVersion } from "@/db/queries/insert/insertPgaFlagVersion";
import { listPgaFlagVersions } from "@/db/queries/select/many/listPgaFlagVersions";
import { updatePgaFlagVersion } from "@/db/queries/update/updatePgaFlagVersion";
import { PgaFlagRequirement } from "@/db/schema";

interface SeedFile {
  header: { source: string; pubNumber: string; publishedAt: string };
  flags: Array<{
    htsPrefix: string;
    agencyCode: string;
    flagCode: string;
    requirement: string;
    programDescription?: string;
  }>;
}

const DEFAULT_SEED = resolve(__dirname, "../src/db/reference/pga-flags.json");

async function main() {
  const path = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_SEED;
  const seed = JSON.parse(readFileSync(path, "utf8")) as SeedFile;

  const { header, flags } = seed;
  if (!header?.pubNumber || !header?.publishedAt || !flags?.length) {
    throw new Error(`Seed file ${path} is missing header fields or flags`);
  }

  const requirementValues = new Set<string>(Object.values(PgaFlagRequirement));
  const invalid = flags.filter(
    (flag) =>
      !requirementValues.has(flag.requirement) ||
      !/^\d{2,10}$/.test(flag.htsPrefix) ||
      flag.htsPrefix.length % 2 !== 0,
  );
  if (invalid.length > 0) {
    throw new Error(
      `${invalid.length} invalid rows (bad requirement or htsPrefix), e.g. ${JSON.stringify(invalid[0])}`,
    );
  }

  const { data: existing } = await listPgaFlagVersions({
    pubNumber: header.pubNumber,
  });
  const alreadyImported = existing.find(
    (version) =>
      version.publishedAt.getTime() === new Date(header.publishedAt).getTime(),
  );
  if (alreadyImported) {
    console.log(
      `Publication ${header.pubNumber} (${header.publishedAt}) already imported as version ${alreadyImported.id}${alreadyImported.active ? " (active)" : ""} — nothing to do`,
    );
    return;
  }

  console.log(
    `Importing ${flags.length} flag rows from ${header.source} ${header.pubNumber} (${header.publishedAt})`,
  );

  const version = await insertPgaFlagVersion({
    source: header.source,
    pubNumber: header.pubNumber,
    publishedAt: new Date(header.publishedAt),
    importedAt: new Date(),
    recordCount: flags.length,
    active: false,
  });

  const CHUNK = 1000;
  for (let start = 0; start < flags.length; start += CHUNK) {
    const chunk = flags.slice(start, start + CHUNK).map((flag) => ({
      versionId: version.id,
      htsPrefix: flag.htsPrefix,
      prefixLength: flag.htsPrefix.length,
      agencyCode: flag.agencyCode,
      flagCode: flag.flagCode,
      programDescription: flag.programDescription ?? null,
      requirement: flag.requirement as PgaFlagRequirement,
    }));
    await insertPgaFlags(chunk);
    console.log(
      `  inserted ${Math.min(start + CHUNK, flags.length)}/${flags.length}`,
    );
  }

  // Flip the active pointer atomically: deactivate old versions and
  // activate the new one in one transaction.
  await db.transaction(async () => {
    const { data: activeVersions } = await listPgaFlagVersions({
      active: true,
    });
    for (const old of activeVersions) {
      await updatePgaFlagVersion(old.id, { active: false });
    }
    await updatePgaFlagVersion(version.id, { active: true });
  });

  console.log(`Version ${version.id} is now active`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
