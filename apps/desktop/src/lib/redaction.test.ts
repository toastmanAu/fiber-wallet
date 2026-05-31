import { describe, expect, it } from "vitest";
import { redactSecrets } from "./redaction";

describe("redactSecrets", () => {
  it("redacts bearer tokens", () => {
    expect(redactSecrets("Authorization: Bearer abcdef.123456")).toBe("Authorization: Bearer [REDACTED]");
  });

  it("redacts Fiber unlock passwords", () => {
    expect(redactSecrets("FIBER_SECRET_KEY_PASSWORD='correct horse battery staple'")).toContain("[REDACTED]");
  });

  it("redacts BIP39 recovery phrases", () => {
    const phrase = "seed phrase: abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    expect(redactSecrets(phrase)).toBe("seed phrase: [REDACTED]");
  });
});
