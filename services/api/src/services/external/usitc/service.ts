import { z } from "zod";
import { PdfPreviewService } from "@/services/pdf/service";
import { htsFile, htsRequest } from "./client";

/* -------------------------------------------------------------------------------------------------
 * Inputs — zod schemas double as the inputSchema of the agent tools.
 * -----------------------------------------------------------------------------------------------*/

export const searchHtsInput = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      "Keywords ('wifi router') or an HTS number at any depth ('8517', '8517.62', '8517.62.00'). Keyword search stems words; quote a phrase to disable stemming.",
    ),
});

export type SearchHtsInput = z.infer<typeof searchHtsInput>;

export const browseHeadingInput = z.object({
  heading: z
    .string()
    .regex(/^\d{4}$/)
    .describe(
      "A 4-digit HTS heading, e.g. '8517'. Returns the heading's full subtree — every subheading down to the 10-digit statistical suffixes, with duty rates.",
    ),
});

export type BrowseHeadingInput = z.infer<typeof browseHeadingInput>;

export const chapterNotesInput = z.object({
  chapter: z
    .number()
    .int()
    .min(1)
    .max(99)
    .describe(
      "HTS chapter number (1–99). Returns the chapter's legally binding Notes (and Additional U.S. Notes). Section Notes are printed in the section's FIRST chapter — e.g. Section XVI Notes (machinery, chapters 84–85) are in chapter 84.",
    ),
});

export type ChapterNotesInput = z.infer<typeof chapterNotesInput>;

/* -------------------------------------------------------------------------------------------------
 * Outputs — compact, LLM-friendly projections.
 * -----------------------------------------------------------------------------------------------*/

/** Raw line shape returned by hts.usitc.gov search/export endpoints. */
interface HtsApiLine {
  htsno: string | null;
  indent: string | null;
  description: string | null;
  units: string[] | null;
  general: string | null;
  special: string | null;
  other: string | null;
  footnotes: Array<{ value?: string | null }> | null;
}

export interface HtsLine {
  /** Empty for grouping rows that only carry a superior description. */
  htsNumber: string;
  /** Hierarchy depth — child lines inherit their parents' descriptions. */
  indent: number;
  description: string;
  /** Column 1 General duty rate, e.g. 'Free' or '2.6%'. */
  general: string;
  /** Column 1 Special (preferential program) rates. */
  special: string;
  /** Column 2 rate (non-NTR countries). */
  other: string;
  units: string[];
  footnotes: string[];
  /** Chapter 99 additional-duty programs referenced by the footnotes. */
  overlays: Array<{ program: string; chapter99: string }>;
}

const OVERLAY_PROGRAMS: Array<{ prefix: string; program: string }> = [
  { prefix: "9903.88", program: "Section 301 (China)" },
  { prefix: "9903.80", program: "Section 232 (steel)" },
  { prefix: "9903.81", program: "Section 232 (steel)" },
  { prefix: "9903.85", program: "Section 232 (aluminum)" },
  { prefix: "9903.78", program: "Section 232 (copper)" },
];

function parseOverlays(footnotes: string[]): HtsLine["overlays"] {
  const overlays: HtsLine["overlays"] = [];
  for (const note of footnotes) {
    for (const code of note.match(/9903\.\d{2}\.\d{2}/g) ?? []) {
      const program =
        OVERLAY_PROGRAMS.find(({ prefix }) => code.startsWith(prefix))
          ?.program ?? "Chapter 99 additional duty";
      if (!overlays.some((overlay) => overlay.chapter99 === code)) {
        overlays.push({ program, chapter99: code });
      }
    }
  }
  return overlays;
}

function toLine(line: HtsApiLine): HtsLine {
  const footnotes = (line.footnotes ?? [])
    .map((footnote) => footnote.value?.trim() ?? "")
    .filter(Boolean);

  return {
    htsNumber: line.htsno ?? "",
    indent: Number(line.indent ?? 0),
    description: line.description?.trim() ?? "",
    general: line.general?.trim() ?? "",
    special: line.special?.trim() ?? "",
    other: line.other?.trim() ?? "",
    units: line.units ?? [],
    footnotes,
    overlays: parseOverlays(footnotes),
  };
}

/** Chapter notes are stable for the life of the process — cache the text. */
const chapterNotesCache = new Map<number, string>();

/**
 * The Harmonized Tariff Schedule at hts.usitc.gov — the legal nomenclature,
 * duty rates, and binding Section/Chapter Notes the classifier works from.
 */
export class HtsService {
  /** Broad keywords can match hundreds of lines — cap what the agent sees. */
  private static readonly MAX_SEARCH_LINES = 60;

  static async search(input: SearchHtsInput): Promise<HtsLine[]> {
    const response = await htsRequest<HtsApiLine[]>("/search", {
      keyword: input.query,
    });
    return response.slice(0, HtsService.MAX_SEARCH_LINES).map(toLine);
  }

  static async browseHeading(input: BrowseHeadingInput): Promise<HtsLine[]> {
    // The export range only includes a heading's children when `to` extends
    // past it — request one heading further and trim the overshoot.
    const next = String(Math.min(Number(input.heading) + 1, 9999)).padStart(
      4,
      "0",
    );
    const response = await htsRequest<HtsApiLine[]>("/exportList", {
      from: input.heading,
      to: next,
      format: "JSON",
      styles: false,
    });

    return response
      .map(toLine)
      .filter(
        (line) =>
          line.htsNumber === "" || line.htsNumber.startsWith(input.heading),
      );
  }

  static async chapterNotes(input: ChapterNotesInput): Promise<string> {
    const cached = chapterNotesCache.get(input.chapter);
    if (cached) return cached;

    const pdf = await htsFile(`Chapter ${input.chapter}`);
    const pages = await PdfPreviewService.text({ data: pdf });

    // The Notes come first; the tariff table pages carry a "Rates of Duty"
    // column header. Keep everything up to the first table page.
    const tableStart = pages.findIndex((page) =>
      page.includes("Rates of Duty"),
    );
    const notePages = tableStart === -1 ? pages : pages.slice(0, tableStart);

    const text = notePages
      .join("\n")
      .replace(/\r\n?/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 60_000);

    chapterNotesCache.set(input.chapter, text);
    return text;
  }
}

/** The user-facing HTS search URL for a query — the audit reference. */
export function htsSearchUrl(query: string): string {
  return `https://hts.usitc.gov/search?query=${encodeURIComponent(query)}`;
}

/** The published chapter PDF — where the Notes text lives. */
export function chapterNotesUrl(chapter: number): string {
  return `https://hts.usitc.gov/reststop/file?release=currentRelease&filename=${encodeURIComponent(`Chapter ${chapter}`)}`;
}
