import { describe, expect, it } from "vitest";
import { buildDiagnosticBundle } from "./diagnostics";
import type { Profile } from "./profileStore";

const profile: Profile = {
  id: "test",
  name: "Test",
  mode: "existing-local",
  network: "testnet",
  rpcMode: "mock",
  preferredPqrLock: "mldsa",
  recoveryFormat: "bip39",
  fiberRpcEndpoint: "http://127.0.0.1:8227",
  ckbRpcEndpoint: "https://testnet.ckbapp.dev/",
  fnnBinaryPath: "",
  dataDir: "/tmp/fnn",
  configPath: "/tmp/fnn/config.yml",
  p2pListeningAddr: "/ip4/127.0.0.1/tcp/8228",
  rpcListeningAddr: "127.0.0.1:8227",
  biscuitPublicKey: "ed25519/example",
  peerAddressBook: [],
  createdAt: "2026-05-31T00:00:00.000Z",
};

describe("buildDiagnosticBundle", () => {
  it("redacts secrets from diagnostic JSON", () => {
    const bundle = buildDiagnosticBundle({
      appVersion: "0.1.0",
      profile,
      rpcStatus: "Authorization: Bearer secret-token",
      graph: {
        nodeCount: 1,
        channelCount: 1,
      },
      rpcHealth: {
        node_info: "ok Authorization: Bearer secret-token",
      },
      configContents: `biscuit_private_key: ed25519-private/${"a".repeat(64)}`,
      recentLogs: "FIBER_SECRET_KEY_PASSWORD='correct horse battery staple'",
      gapChecks: ["docs/gap-checks/milestone-0.md"],
    });

    expect(bundle).toContain("Authorization: Bearer [REDACTED]");
    expect(bundle).toContain("biscuit_private_key: ed25519-private/[REDACTED]");
    expect(bundle).toContain("FIBER_SECRET_KEY_PASSWORD='[REDACTED]'");
    expect(bundle).not.toContain("secret-token");
    expect(bundle).not.toContain("correct horse battery staple");
    expect(() => JSON.parse(bundle)).not.toThrow();
  });
});
