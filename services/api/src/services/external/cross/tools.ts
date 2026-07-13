import { tool } from "ai";
import {
  CrossRulingsService,
  crossSearchUrl,
  getRulingInput,
  searchRulingsInput,
} from "./service";

const SOURCE = "CBP CROSS";

/**
 * CROSS precedent research, packaged for the classification agent. Every
 * result is wrapped in a source envelope — `url` is the exact search that was
 * run (or the ruling's public page), for the audit record and citation hrefs.
 */
export const crossRulingsTools = {
  searchRulings: tool({
    description:
      "Search CBP's CROSS database of binding customs rulings by keyword, product description, or HTS number. Returns ruling summaries with tariff numbers and revocation status. Use getRuling to read a ruling's full text. The result's url field is the exact CROSS search you ran; use it as the href when citing the search.",
    inputSchema: searchRulingsInput,
    execute: async (input) => ({
      source: SOURCE,
      url: crossSearchUrl(input),
      ...(await CrossRulingsService.search(input)),
    }),
  }),
  getRuling: tool({
    description:
      "Fetch the full text and metadata of a specific CROSS ruling by ruling number. Check the revoked flag before citing — revoked rulings are no longer good law. The result's url field is the ruling's public page; use it as the href when citing the ruling.",
    inputSchema: getRulingInput,
    execute: async (input) => {
      const ruling = await CrossRulingsService.ruling(input);
      return { source: SOURCE, ...ruling };
    },
  }),
};
