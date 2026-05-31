import { describe, expect, it } from "vitest";
import { blocksLiveRpc, classifyRpcEndpoint } from "./endpointSafety";
import type { Profile } from "./profileStore";

const profile: Profile = {
  id: "test",
  name: "Test",
  mode: "remote",
  network: "testnet",
  rpcMode: "live",
  preferredPqrLock: "mldsa",
  recoveryFormat: "bip39",
  fiberRpcEndpoint: "https://fiber.example.com",
  ckbRpcEndpoint: "https://testnet.ckbapp.dev/",
  fnnBinaryPath: "",
  dataDir: "",
  configPath: "",
  p2pListeningAddr: "/ip4/127.0.0.1/tcp/8228",
  rpcListeningAddr: "127.0.0.1:8227",
  createdAt: "2026-05-31T00:00:00.000Z",
};

describe("classifyRpcEndpoint", () => {
  it("classifies loopback endpoints", () => {
    expect(classifyRpcEndpoint("http://127.0.0.1:8227").kind).toBe("loopback");
    expect(classifyRpcEndpoint("http://localhost:8227").kind).toBe("loopback");
  });

  it("classifies private endpoints", () => {
    expect(classifyRpcEndpoint("http://192.168.1.10:8227").kind).toBe("private");
    expect(classifyRpcEndpoint("http://10.0.0.4:8227").kind).toBe("private");
  });

  it("requires tokens for public endpoints", () => {
    const safety = classifyRpcEndpoint("https://fiber.example.com");

    expect(safety.kind).toBe("public");
    expect(safety.requiresToken).toBe(true);
  });

  it("rejects embedded credentials", () => {
    expect(classifyRpcEndpoint("https://user:pass@fiber.example.com").kind).toBe("invalid");
  });
});

describe("blocksLiveRpc", () => {
  it("blocks public live RPC without a token", () => {
    expect(blocksLiveRpc(profile)?.kind).toBe("public");
  });

  it("allows public live RPC with a token", () => {
    expect(blocksLiveRpc(profile, "token")).toBeNull();
  });

  it("does not block mock mode", () => {
    expect(blocksLiveRpc({ ...profile, rpcMode: "mock" })).toBeNull();
  });
});
