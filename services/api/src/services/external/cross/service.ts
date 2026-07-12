import { z } from "zod";
import { crossRequest } from "./client";

/* -------------------------------------------------------------------------------------------------
 * Inputs — zod schemas double as the inputSchema of the agent tools, so every
 * field carries a model-facing description and a sensible default.
 * -----------------------------------------------------------------------------------------------*/

export const searchRulingsInput = z.object({
  term: z
    .string()
    .min(1)
    .describe(
      "Search query — product keywords ('wifi router'), an HTS number ('8517.62.0020'), or a ruling number.",
    ),
  collection: z
    .enum(["ALL", "HQ", "NY"])
    .default("ALL")
    .describe(
      "HQ = Headquarters rulings (binding, precedential legal analyses); NY = New York rulings (routine classification decisions); ALL = both.",
    ),
  sortBy: z
    .enum(["RELEVANCE", "DATE_DESC", "DATE_ASC"])
    .default("RELEVANCE")
    .describe(
      "RELEVANCE for best matches; DATE_DESC for the most recent rulings first.",
    ),
  page: z.number().int().min(1).default(1).describe("1-based page number."),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .describe("Results per page (max 100)."),
  commodityGrouping: z
    .string()
    .default("ALL")
    .describe(
      "CBP commodity grouping filter; leave as ALL unless a specific grouping is known.",
    ),
});

export type SearchRulingsInput = z.infer<typeof searchRulingsInput>;

export const getRulingInput = z.object({
  rulingNumber: z
    .string()
    .min(1)
    .describe("The CROSS ruling number, e.g. 'N238460' or 'H302172'."),
});

export type GetRulingInput = z.infer<typeof getRulingInput>;

/* -------------------------------------------------------------------------------------------------
 * Outputs — compact, LLM-friendly projections of the raw API payloads.
 * -----------------------------------------------------------------------------------------------*/

/** Raw ruling shape returned by rulings.cbp.gov (search hits and detail). */
interface CrossApiRuling {
  id: number;
  rulingNumber: string;
  subject: string;
  categories: string;
  rulingDate: string;
  collection: string;
  relatedRulings: string[];
  modifies: string[];
  modifiedBy: string[];
  revokes: string[];
  revokedBy: string[];
  tariffs: string[];
  operationallyRevoked: boolean;
}

export interface RulingSummary {
  rulingNumber: string;
  subject: string;
  /** HQ (Headquarters, precedential) or NY (routine classification). */
  collection: string;
  category: string;
  rulingDate: string;
  /** HTS numbers the ruling classifies under. */
  tariffs: string[];
  /** Precedent health — how this ruling relates to others. */
  relatedRulings: string[];
  modifies: string[];
  modifiedBy: string[];
  revokes: string[];
  revokedBy: string[];
  /** True when the ruling is no longer good law — never cite these. */
  revoked: boolean;
  url: string;
}

export interface SearchRulingsResult {
  totalHits: number;
  page: number;
  pageSize: number;
  rulings: RulingSummary[];
}

export type RulingDetail = RulingSummary & {
  /** The full ruling text — facts, analysis, holding. */
  text: string;
};

function toSummary(ruling: CrossApiRuling): RulingSummary {
  return {
    rulingNumber: ruling.rulingNumber,
    subject: ruling.subject,
    collection: ruling.collection?.toUpperCase() ?? "",
    category: ruling.categories,
    rulingDate: ruling.rulingDate?.slice(0, 10) ?? "",
    tariffs: ruling.tariffs ?? [],
    relatedRulings: ruling.relatedRulings ?? [],
    modifies: ruling.modifies ?? [],
    modifiedBy: ruling.modifiedBy ?? [],
    revokes: ruling.revokes ?? [],
    revokedBy: ruling.revokedBy ?? [],
    revoked: ruling.operationallyRevoked || (ruling.revokedBy ?? []).length > 0,
    url: `https://rulings.cbp.gov/ruling/${ruling.rulingNumber}`,
  };
}

/** The ruling text arrives with carriage returns and form feeds. */
function normalizeRulingText(text: string): string {
  return text
    .replace(/\f/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * CBP's CROSS database (rulings.cbp.gov) — the public record of binding
 * customs rulings. The classification agent searches it for precedent.
 */
export class CrossRulingsService {
  static async search(input: SearchRulingsInput): Promise<SearchRulingsResult> {
    const response = await crossRequest<{
      rulings: CrossApiRuling[];
      totalHits: number;
    }>("/search", {
      term: input.term,
      collection: input.collection,
      commodityGrouping: input.commodityGrouping,
      pageSize: input.pageSize,
      page: input.page,
      sortBy: input.sortBy,
    });

    return {
      totalHits: response.totalHits,
      page: input.page,
      pageSize: input.pageSize,
      rulings: response.rulings.map(toSummary),
    };
  }

  static async ruling(input: GetRulingInput): Promise<RulingDetail> {
    const rulingNumber = input.rulingNumber.trim();
    let response: CrossApiRuling & { text: string };
    try {
      response = await crossRequest<CrossApiRuling & { text: string }>(
        `/ruling/${encodeURIComponent(rulingNumber)}`,
      );
    } catch (error) {
      // Some older rulings (numeric pre-1997 numbers) are indexed in search
      // results but have no retrievable document.
      if (error instanceof Error && error.message.includes("(404)")) {
        throw new Error(
          `Ruling ${rulingNumber} was not found in CROSS — its full text may not be digitized. Rely on its search-result summary instead.`,
        );
      }
      throw error;
    }

    return {
      ...toSummary(response),
      text: normalizeRulingText(response.text ?? ""),
    };
  }
}
