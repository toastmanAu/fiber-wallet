import { describe, expect, it } from "vitest";
import { fiberRpc, formatRpcError } from "./fiberRpc";
import type { Profile } from "./profileStore";

const mockProfile: Profile = {
  id: "test",
  name: "Test",
  mode: "existing-local",
  network: "testnet",
  rpcMode: "mock",
  preferredPqrLock: "mldsa",
  recoveryFormat: "bip39",
  fiberRpcEndpoint: "http://127.0.0.1:8227",
  ckbRpcEndpoint: "https://testnet.ckbapp.dev/",
  mainnetAcknowledgedAt: "",
  fnnBinaryPath: "",
  dataDir: "",
  configPath: "",
  p2pListeningAddr: "/ip4/127.0.0.1/tcp/8228",
  rpcListeningAddr: "127.0.0.1:8227",
  biscuitPublicKey: "",
  ckbLockLabel: "",
  ckbLockScript: "",
  peerAddressBook: [],
  createdAt: "2026-05-31T00:00:00.000Z",
};

describe("fiberRpc", () => {
  it("uses mock fixtures when profile is in mock mode", async () => {
    await expect(fiberRpc("node_info", [], { profile: mockProfile })).resolves.toMatchObject({
      node_name: "mock-fiber-node",
    });
  });

  it("blocks public live endpoints without a token", async () => {
    await expect(
      fiberRpc("node_info", [], {
        profile: {
          ...mockProfile,
          rpcMode: "live",
          fiberRpcEndpoint: "https://fiber.example.com",
        },
      }),
    ).rejects.toMatchObject({
      kind: "public_rpc_requires_auth",
    });
  });

  it("formats auth failures with Biscuit remediation context", () => {
    expect(
      formatRpcError({
        kind: "auth_required",
        message: "Fiber RPC error -32999: Unauthorized",
        status: 200,
      }),
    ).toBe("Biscuit auth required or invalid: Fiber RPC error -32999: Unauthorized");
  });

  it("formats permission failures with Biscuit scope context", () => {
    expect(
      formatRpcError({
        kind: "permission_denied",
        message: "Fiber RPC error -32999: Permission denied for method",
        status: 200,
      }),
    ).toBe("Biscuit token permission denied: Fiber RPC error -32999: Permission denied for method");
  });
});
