import { describe, expect, it } from "vitest";
import { fiberRpc } from "./fiberRpc";
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
  createdAt: "2026-05-31T00:00:00.000Z",
};

describe("fiberRpc", () => {
  it("uses mock fixtures when profile is in mock mode", async () => {
    await expect(fiberRpc("node_info", [], { profile: mockProfile })).resolves.toMatchObject({
      node_name: "mock-fiber-node",
    });
  });
});
