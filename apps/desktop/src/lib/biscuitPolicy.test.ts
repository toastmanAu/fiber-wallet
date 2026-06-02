import { describe, expect, it } from "vitest";
import { assertMobilePairingBiscuit, expectedMobilePairingBiscuitSource } from "./biscuitPolicy";

const expiry = "2026-07-01T00:00:00Z";

describe("mobile pairing Biscuit policy", () => {
  it("accepts the exact limited mobile pairing scope", () => {
    expect(() =>
      assertMobilePairingBiscuit(
        {
          public_key: "ed25519/example",
          source: expectedMobilePairingBiscuitSource(expiry),
          block_count: 1,
          revocation_ids: [],
        },
        expiry,
      ),
    ).not.toThrow();
  });

  it("rejects broader write permissions", () => {
    expect(() =>
      assertMobilePairingBiscuit(
        {
          public_key: "ed25519/example",
          source: `${expectedMobilePairingBiscuitSource(expiry)}\nwrite("channels");`,
          block_count: 1,
          revocation_ids: [],
        },
        expiry,
      ),
    ).toThrow("limited template");
  });

  it("rejects extra attenuating blocks", () => {
    expect(() =>
      assertMobilePairingBiscuit(
        {
          public_key: "ed25519/example",
          source: expectedMobilePairingBiscuitSource(expiry),
          block_count: 2,
          revocation_ids: [],
        },
        expiry,
      ),
    ).toThrow("exactly one authority block");
  });
});
