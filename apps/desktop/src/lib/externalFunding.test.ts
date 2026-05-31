import { describe, expect, it } from "vitest";
import { compareFundingTxStructure } from "./externalFunding";

const unsignedTx = {
  version: "0x0",
  cell_deps: [{ out_point: { tx_hash: "0xabc", index: "0x0" }, dep_type: "code" }],
  header_deps: [],
  inputs: [{ previous_output: { tx_hash: "0xdef", index: "0x0" }, since: "0x0" }],
  outputs: [{ capacity: "0x1", lock: { code_hash: "0x01", hash_type: "type", args: "0x02" } }],
  outputs_data: ["0x"],
  witnesses: [],
};

describe("compareFundingTxStructure", () => {
  it("allows witness-only external signer changes", () => {
    const signedTx = {
      ...unsignedTx,
      witnesses: ["0x5500000010000000550000005500000041000000"],
    };

    expect(compareFundingTxStructure(unsignedTx, signedTx)).toMatchObject({
      unchanged: true,
      changedKeys: [],
    });
  });

  it("rejects structural funding tx changes", () => {
    const signedTx = {
      ...unsignedTx,
      outputs_data: ["0x01"],
    };

    expect(compareFundingTxStructure(unsignedTx, signedTx)).toMatchObject({
      unchanged: false,
      changedKeys: ["outputs_data"],
    });
  });
});
