import { describe, expect, it } from "vitest";
import { parseRpcParams } from "./consoleUtils";

describe("parseRpcParams", () => {
  it("returns an empty array for blank input", () => {
    expect(parseRpcParams(" ")).toEqual([]);
  });

  it("accepts JSON arrays", () => {
    expect(parseRpcParams('[{"limit":"0xa"}]')).toEqual([{ limit: "0xa" }]);
  });

  it("rejects non-array JSON", () => {
    expect(() => parseRpcParams('{"limit":"0xa"}')).toThrow("Params must be a JSON array");
  });
});

