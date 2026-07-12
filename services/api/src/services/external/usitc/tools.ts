import { tool } from "ai";
import {
  browseHeadingInput,
  chapterNotesInput,
  HtsService,
  searchHtsInput,
} from "./service";

/** HTSUS nomenclature research, packaged for the classification agent. */
export const htsTools = {
  searchHts: tool({
    description:
      "Search the Harmonized Tariff Schedule by keyword or HTS number. Returns tariff lines with descriptions, duty rates (general/special/column 2), and Chapter 99 overlay flags (Section 301/232 additional duties) parsed from footnotes — include those in the duty picture.",
    inputSchema: searchHtsInput,
    execute: (input) => HtsService.search(input),
  }),
  browseHtsHeading: tool({
    description:
      "List a 4-digit HTS heading's complete subtree — every subheading down to the 10-digit statistical suffix, with rates. Use this to apply GRI 6 and pick the exact statistical line once a heading is chosen.",
    inputSchema: browseHeadingInput,
    execute: (input) => HtsService.browseHeading(input),
  }),
  getChapterNotes: tool({
    description:
      "Read the legally binding Notes for an HTS chapter (Chapter Notes + Additional U.S. Notes; Section Notes appear in the section's first chapter — e.g. chapter 84 carries Section XVI Notes covering chapters 84–85). Read these for every candidate heading before settling on a classification — they can force inclusion or exclusion.",
    inputSchema: chapterNotesInput,
    execute: (input) => HtsService.chapterNotes(input),
  }),
};
