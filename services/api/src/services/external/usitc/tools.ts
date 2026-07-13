import { tool } from "ai";
import {
  browseHeadingInput,
  chapterNotesInput,
  chapterNotesUrl,
  HtsService,
  htsSearchUrl,
  searchHtsInput,
} from "./service";

const SOURCE = "HTSUS (USITC)";

/**
 * HTSUS nomenclature research, packaged for the classification agent. Every
 * result is wrapped in a source envelope — `url` is the exact search that was
 * run, for the audit record and for citation hrefs.
 */
export const htsTools = {
  searchHts: tool({
    description:
      "Search the Harmonized Tariff Schedule by keyword or HTS number. Returns tariff lines with descriptions, duty rates (general/special/column 2), and Chapter 99 overlay flags (Section 301/232 additional duties) parsed from footnotes — include those in the duty picture. The result's url field is the exact search you ran; use it as the href when citing these lines.",
    inputSchema: searchHtsInput,
    execute: async (input) => ({
      source: SOURCE,
      url: htsSearchUrl(input.query),
      lines: await HtsService.search(input),
    }),
  }),
  browseHtsHeading: tool({
    description:
      "List a 4-digit HTS heading's complete subtree — every subheading down to the 10-digit statistical suffix, with rates. Use this to apply GRI 6 and pick the exact statistical line once a heading is chosen. The result's url field is the citable reference for the heading.",
    inputSchema: browseHeadingInput,
    execute: async (input) => ({
      source: SOURCE,
      url: htsSearchUrl(input.heading),
      lines: await HtsService.browseHeading(input),
    }),
  }),
  getChapterNotes: tool({
    description:
      "Read the legally binding Notes for an HTS chapter (Chapter Notes + Additional U.S. Notes; Section Notes appear in the section's first chapter — e.g. chapter 84 carries Section XVI Notes covering chapters 84–85). Read these for every candidate heading before settling on a classification — they can force inclusion or exclusion. The result's url field points at the published chapter document; use it as the href when citing a Note.",
    inputSchema: chapterNotesInput,
    execute: async (input) => ({
      source: SOURCE,
      url: chapterNotesUrl(input.chapter),
      chapter: input.chapter,
      notes: await HtsService.chapterNotes(input),
    }),
  }),
};
