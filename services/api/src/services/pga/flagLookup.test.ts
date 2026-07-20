import { describe, expect, test } from "bun:test";
import { expandHtsPrefixes, normalizeHtsCode } from "./flagLookup";

describe("normalizeHtsCode", () => {
  test("strips dots from a full 10-digit code", () => {
    expect(normalizeHtsCode("8517.62.0020")).toBe("8517620020");
  });

  test("passes through undotted codes", () => {
    expect(normalizeHtsCode("2106909998")).toBe("2106909998");
  });

  test("strips whitespace and stray characters", () => {
    expect(normalizeHtsCode(" 0602.90.30-10 ")).toBe("0602903010");
  });
});

describe("expandHtsPrefixes", () => {
  test("expands a 10-digit code to all even-length prefixes", () => {
    expect(expandHtsPrefixes("8517.62.0020")).toEqual([
      "85",
      "8517",
      "851762",
      "85176200",
      "8517620020",
    ]);
  });

  test("expands an 8-digit code without inventing longer prefixes", () => {
    expect(expandHtsPrefixes("2106.90.99")).toEqual([
      "21",
      "2106",
      "210690",
      "21069099",
    ]);
  });

  test("keeps leading zeros (chapter 06 plants)", () => {
    expect(expandHtsPrefixes("0602.90.3010")).toEqual([
      "06",
      "0602",
      "060290",
      "06029030",
      "0602903010",
    ]);
  });

  test("returns nothing useful for junk input", () => {
    expect(expandHtsPrefixes("n/a")).toEqual([]);
  });
});
