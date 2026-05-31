import { describe, expect, it } from "vitest";
import { parseRpcParams, requiresRawRpcConfirmation, shortenForConsole, validateRpcParams } from "./consoleUtils";

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

  it("validates required params for write methods", () => {
    expect(() => validateRpcParams("open_channel", [{ pubkey: "02abc", funding_amount: "1000" }])).not.toThrow();
    expect(() => validateRpcParams("open_channel", [{ pubkey: "02abc" }])).toThrow("open_channel requires: funding_amount");
  });

  it("validates route arrays", () => {
    expect(() => validateRpcParams("send_payment_with_router", [{ router: [] }])).not.toThrow();
    expect(() => validateRpcParams("send_payment_with_router", [{ router: {} }])).toThrow(
      "send_payment_with_router.router must be a JSON array",
    );
  });

  it("allows read methods without params", () => {
    expect(() => validateRpcParams("node_info", [])).not.toThrow();
    expect(() => validateRpcParams("graph_nodes", [{ limit: "10" }])).not.toThrow();
  });
});
