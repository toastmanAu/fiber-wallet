import { describe, expect, it } from "vitest";
import { parseRpcParams, requiresRawRpcConfirmation, shortenForConsole } from "./consoleUtils";

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

  it("requires confirmation for raw write methods", () => {
    expect(requiresRawRpcConfirmation("open_channel")).toBe(true);
    expect(requiresRawRpcConfirmation("send_payment")).toBe(true);
    expect(requiresRawRpcConfirmation("node_info")).toBe(false);
    expect(requiresRawRpcConfirmation("graph_nodes")).toBe(false);
  });

  it("shortens console confirmation previews", () => {
    expect(shortenForConsole("abcdef", 6)).toBe("abcdef");
    expect(shortenForConsole("abcdef", 5)).toBe("ab...");
  });
});
