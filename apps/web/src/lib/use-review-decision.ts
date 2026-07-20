import { useState } from "react";
import type { LineCorrection } from "#/lib/review-types";

/**
 * The broker's staged decision: a single-line alternate pick, or per-line
 * substitutions for a multi-line review. Purely local until the resolve
 * call carries it to the server.
 */
export function useReviewDecision() {
  const [alternate, setAlternate] = useState<string | null>(null);
  /** Staged per-line substitutions: lineItemId → chosen alternate code. */
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const correctionEntries: LineCorrection[] = Object.entries(corrections).map(
    ([lineItemId, alternateValue]) => ({
      lineItemId,
      alternate: alternateValue,
    }),
  );

  const stageCorrection = (lineItemId: string, value: string | null) => {
    setCorrections((current) => {
      if (value === null) {
        const { [lineItemId]: _, ...rest } = current;
        return rest;
      }
      return { ...current, [lineItemId]: value };
    });
  };

  const reset = () => {
    setAlternate(null);
    setCorrections({});
  };

  return {
    alternate,
    setAlternate,
    corrections,
    correctionEntries,
    stageCorrection,
    reset,
  };
}

export type ReviewDecision = ReturnType<typeof useReviewDecision>;
