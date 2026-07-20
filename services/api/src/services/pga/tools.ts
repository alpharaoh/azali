import { tool } from "ai";
import { z } from "zod";
import { PgaFlagLookupService } from "./flagLookup";

/**
 * Deterministic PGA reference lookups for the screening agent. The flag
 * table is our ingested, versioned copy of the agencies' published flag
 * lists; the platform records the exact version on every determination row
 * (flagVersionId) — the model never sees or cites internal version
 * identifiers.
 */
export const pgaTools = {
  lookupPgaFlags: tool({
    description:
      "Look up the PGA tariff flags (FDA FD1/FD2, APHIS AQ1/AQ2, NHTSA DT1/DT2, …) attached to an HTS code in the platform's current agency flag reference. Deterministic table lookup, not a search. The platform records the reference version on the audit trail automatically — do NOT cite it; cite the governing regulations and agency guidance instead. Remember the flags are a prior, not ground truth: an unflagged code can still be regulated (flag tables lag HTS revisions), and a flagged code can be formally disclaimed when the agency does not regulate this shipment.",
    inputSchema: z.object({
      htsCode: z
        .string()
        .describe(
          "The HTS code to look up, dotted or not, e.g. '2106.90.9898'.",
        ),
    }),
    execute: async (input) => {
      const result = await PgaFlagLookupService.lookup(input.htsCode);
      return {
        source: "CBP ACE agency flag reference",
        currentAsOf: result.version.publishedAt.toISOString().slice(0, 10),
        flags: result.flags,
      };
    },
  }),
};
