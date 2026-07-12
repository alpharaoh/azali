import { tool } from "ai";
import {
  CrossRulingsService,
  getRulingInput,
  searchRulingsInput,
} from "./service";

/** CROSS precedent research, packaged for the classification agent. */
export const crossRulingsTools = {
  searchRulings: tool({
    description:
      "Search CBP's CROSS database of binding customs rulings by keyword, product description, or HTS number. Returns ruling summaries with tariff numbers and revocation status. Use getRuling to read a ruling's full text.",
    inputSchema: searchRulingsInput,
    execute: (input) => CrossRulingsService.search(input),
  }),
  getRuling: tool({
    description:
      "Fetch the full text and metadata of a specific CROSS ruling by ruling number. Check the revoked flag before citing — revoked rulings are no longer good law.",
    inputSchema: getRulingInput,
    execute: (input) => CrossRulingsService.ruling(input),
  }),
};
