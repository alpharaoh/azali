import { tool } from "ai";
import { z } from "zod";
import { PgaFlagLookupService } from "./flagLookup";

const SOURCE = "CBP ACE Agency Tariff Code Reference";

/**
 * Deterministic PGA reference lookups for the screening agent. The flag
 * table is our ingested, versioned copy of CBP's publication — the tool
 * result names the exact publication for the audit record.
 */
export const pgaTools = {
  lookupPgaFlags: tool({
    description:
      "Look up the PGA tariff flags (FDA FD1/FD2, APHIS AQ1/AQ2, NHTSA DT1/DT2, …) attached to an HTS code in the active version of CBP's ACE Agency Tariff Code Reference. Deterministic table lookup, not a search — the result names the publication (pubNumber, publishedAt) to cite as flagTableVersion. Remember the flags are a prior, not ground truth: an unflagged code can still be regulated (flag tables lag HTS revisions), and a flagged code can be formally disclaimed when the agency does not regulate this shipment.",
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
        source: SOURCE,
        pubNumber: result.version.pubNumber,
        publishedAt: result.version.publishedAt.toISOString().slice(0, 10),
        flags: result.flags,
      };
    },
  }),
};
