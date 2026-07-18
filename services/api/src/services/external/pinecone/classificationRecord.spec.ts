import { describe, expect, it } from "bun:test";
import type { SelectProduct } from "@/db/schema";
import {
  DEDUPE_SIMILARITY_THRESHOLD,
  effectiveConfidence,
  planDedupe,
} from "./classificationRecord";
import type { KnowledgeMatch } from "./service";

const product = {
  id: "product-1",
  htsCode: "8518.30.20",
  source: "broker",
  confidence: 0.8,
} as SelectProduct;

const match = (overrides: {
  id: string;
  score?: number;
  htsCode?: string;
  source?: string;
}): KnowledgeMatch => ({
  id: overrides.id,
  score: overrides.score ?? DEDUPE_SIMILARITY_THRESHOLD,
  text: "",
  metadata: {
    productId: overrides.id,
    htsCode: overrides.htsCode ?? product.htsCode,
    source: overrides.source ?? "agent",
  },
});

describe("planDedupe", () => {
  it("inserts when there are no matches", () => {
    expect(planDedupe([], product)).toEqual({
      insert: true,
      removeIds: [],
      conflicts: [],
    });
  });

  it("ignores the product's own record", () => {
    const result = planDedupe([match({ id: product.id })], product);
    expect(result).toEqual({ insert: true, removeIds: [], conflicts: [] });
  });

  it("ignores matches below the similarity threshold", () => {
    const result = planDedupe(
      [match({ id: "product-2", score: DEDUPE_SIMILARITY_THRESHOLD - 0.01 })],
      product,
    );
    expect(result).toEqual({ insert: true, removeIds: [], conflicts: [] });
  });

  it("removes agent-sourced near-duplicates with the same code", () => {
    const result = planDedupe(
      [match({ id: "product-2", source: "agent" })],
      product,
    );
    expect(result).toEqual({
      insert: true,
      removeIds: ["product-2"],
      conflicts: [],
    });
  });

  it("skips the insert when an equivalent broker record exists", () => {
    const result = planDedupe(
      [match({ id: "product-2", source: "broker" })],
      product,
    );
    expect(result).toEqual({ insert: false, removeIds: [], conflicts: [] });
  });

  it("keeps near-duplicates with a different code as conflicts", () => {
    const conflicting = match({ id: "product-2", htsCode: "8518.30.10" });
    const result = planDedupe([conflicting], product);
    expect(result).toEqual({
      insert: true,
      removeIds: [],
      conflicts: [conflicting],
    });
  });

  it("handles a mixed candidate set in one pass", () => {
    const conflicting = match({
      id: "product-4",
      htsCode: "8518.30.10",
      source: "broker",
    });
    const result = planDedupe(
      [
        match({ id: product.id }),
        match({ id: "product-2", source: "agent" }),
        match({ id: "product-3", source: "broker" }),
        conflicting,
        match({ id: "product-5", score: 0.5 }),
      ],
      product,
    );
    expect(result).toEqual({
      insert: false,
      removeIds: ["product-2"],
      conflicts: [conflicting],
    });
  });
});

describe("effectiveConfidence", () => {
  it("reads broker-verified products as full confidence", () => {
    expect(effectiveConfidence(product)).toBe(1);
  });

  it("passes through the agent's confidence otherwise", () => {
    expect(
      effectiveConfidence({ ...product, source: "agent" } as SelectProduct),
    ).toBe(0.8);
    expect(
      effectiveConfidence({
        ...product,
        source: "agent",
        confidence: null,
      } as SelectProduct),
    ).toBeNull();
  });
});
