import { describe, expect, it } from "vitest";
import { mockFiberRpc } from "./mockRpc";

describe("mockFiberRpc", () => {
  it("returns node_info fixture", async () => {
    await expect(mockFiberRpc("node_info")).resolves.toMatchObject({
      node_name: "mock-fiber-node",
      chain: "testnet",
    });
  });

  it("rejects unknown methods", async () => {
    await expect(mockFiberRpc("open_channel")).rejects.toThrow("not implemented");
  });
});

