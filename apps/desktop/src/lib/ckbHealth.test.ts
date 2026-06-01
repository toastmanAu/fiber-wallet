import { describe, expect, it } from "vitest";
import {
  classifyCkbFeeReadiness,
  classifyCkbIndexerReadiness,
  classifyCkbVersionReadiness,
  buildCkbActionGate,
  formatRpcQuantity,
} from "./ckbHealth";

describe("classifyCkbIndexerReadiness", () => {
  it("allows wallet queries when the indexer is current", () => {
    expect(
      classifyCkbIndexerReadiness({
        status: "ok",
        tip_block_number: "0x20",
        indexer_status: "ok",
        indexer_tip_block_number: "0x20",
        indexer_lag_blocks: 0,
      }),
    ).toMatchObject({
      status: "ready",
      blocksWalletQueries: false,
    });
  });

  it("blocks wallet queries when the indexer is unavailable", () => {
    expect(
      classifyCkbIndexerReadiness({
        status: "ok",
        tip_block_number: "0x20",
        indexer_status: "unavailable",
        indexer_message: "indexer disabled",
      }),
    ).toMatchObject({
      status: "unavailable",
      label: "Indexer unavailable",
      detail: "indexer disabled",
      blocksWalletQueries: true,
    });
  });

  it("blocks wallet queries when the indexer is too far behind tip", () => {
    expect(
      classifyCkbIndexerReadiness({
        status: "ok",
        tip_block_number: "0x40",
        indexer_status: "ok",
        indexer_tip_block_number: "0x20",
        indexer_lag_blocks: 32,
      }),
    ).toMatchObject({
      status: "stale",
      label: "Indexer stale",
      blocksWalletQueries: true,
    });
  });
});

describe("classifyCkbFeeReadiness", () => {
  it("uses estimate_fee_rate when the Pool and Experiment probes pass", () => {
    expect(
      classifyCkbFeeReadiness({
        status: "ok",
        indexer_status: "ok",
        pool_status: "ok",
        fee_rate_status: "ok",
        estimated_fee_rate: "0x3e8",
      }),
    ).toMatchObject({
      status: "ready",
      label: "Fee estimate ready",
      blocksFunding: false,
    });
  });

  it("falls back to min fee rate when estimation is unavailable but Pool is ready", () => {
    expect(
      classifyCkbFeeReadiness({
        status: "ok",
        indexer_status: "ok",
        pool_status: "ok",
        fee_rate_status: "fallback_to_pool_min",
        min_fee_rate: "0x3e8",
      }),
    ).toMatchObject({
      status: "warning",
      label: "Fee estimate fallback",
      blocksFunding: false,
    });
  });

  it("blocks funding when Pool RPC is unavailable", () => {
    expect(
      classifyCkbFeeReadiness({
        status: "ok",
        indexer_status: "ok",
        pool_status: "unavailable",
        fee_rate_status: "unavailable",
      }),
    ).toMatchObject({
      status: "blocked",
      label: "Pool unavailable",
      blocksFunding: true,
    });
  });
});

describe("classifyCkbVersionReadiness", () => {
  it("marks the pinned CKB version ready", () => {
    expect(
      classifyCkbVersionReadiness({
        status: "ok",
        indexer_status: "ok",
        version_status: "ok",
        ckb_node_version: "0.206.0 (4141cea 2026-05-06)",
      }),
    ).toMatchObject({
      status: "ready",
      label: "Version pinned",
    });
  });

  it("warns on version mismatches without blocking funding", () => {
    expect(
      classifyCkbVersionReadiness({
        status: "ok",
        indexer_status: "ok",
        version_status: "newer_unverified",
        version_message: "CKB node reports newer unverified version 0.207.0; pinned source baseline is 0.206.0.",
      }),
    ).toMatchObject({
      status: "warning",
      label: "Version unverified",
      blocksFunding: false,
    });
  });

  it("marks compatible patch versions ready", () => {
    expect(
      classifyCkbVersionReadiness({
        status: "ok",
        indexer_status: "ok",
        version_status: "compatible",
        version_message: "CKB node reports compatible patch version 0.206.2.",
      }),
    ).toMatchObject({
      status: "ready",
      label: "Version compatible",
      blocksFunding: false,
    });
  });

  it("blocks funding on unsupported CKB versions", () => {
    expect(
      classifyCkbVersionReadiness({
        status: "ok",
        indexer_status: "ok",
        version_status: "unsupported",
        version_message: "CKB node reports 0.205.0; minimum supported version is 0.206.0.",
      }),
    ).toMatchObject({
      status: "blocked",
      label: "Version unsupported",
      blocksFunding: true,
    });
  });
});

describe("formatRpcQuantity", () => {
  it("formats CKB hex quantities for display", () => {
    expect(formatRpcQuantity("0x3e8")).toBe("1000");
    expect(formatRpcQuantity("1000")).toBe("1000");
    expect(formatRpcQuantity(null)).toBe("unknown");
  });
});

describe("buildCkbActionGate", () => {
  it("does not block offline mock workflows", () => {
    expect(buildCkbActionGate("mock")).toMatchObject({
      status: "mock",
      blocksBalanceQueries: false,
      blocksFundingActions: false,
    });
  });

  it("blocks live funding while probes are loading", () => {
    expect(buildCkbActionGate("live")).toMatchObject({
      status: "checking",
      blocksBalanceQueries: true,
      blocksFundingActions: true,
    });
  });

  it("blocks balance and funding when the indexer is unavailable", () => {
    expect(
      buildCkbActionGate("live", {
        status: "ok",
        indexer_status: "unavailable",
        pool_status: "ok",
        fee_rate_status: "ok",
        version_status: "ok",
      }),
    ).toMatchObject({
      status: "blocked",
      blocksBalanceQueries: true,
      blocksFundingActions: true,
    });
  });

  it("blocks only funding when Pool RPC is unavailable", () => {
    expect(
      buildCkbActionGate("live", {
        status: "ok",
        indexer_status: "ok",
        pool_status: "unavailable",
        fee_rate_status: "unavailable",
        version_status: "ok",
      }),
    ).toMatchObject({
      status: "blocked",
      blocksBalanceQueries: false,
      blocksFundingActions: true,
    });
  });

  it("warns but allows funding on version mismatch", () => {
    expect(
      buildCkbActionGate("live", {
        status: "ok",
        indexer_status: "ok",
        indexer_lag_blocks: 0,
        pool_status: "ok",
        fee_rate_status: "ok",
        estimated_fee_rate: "0x3e8",
        version_status: "newer_unverified",
      }),
    ).toMatchObject({
      status: "warning",
      blocksBalanceQueries: false,
      blocksFundingActions: false,
    });
  });

  it("blocks funding on unsupported CKB versions", () => {
    expect(
      buildCkbActionGate("live", {
        status: "ok",
        indexer_status: "ok",
        indexer_lag_blocks: 0,
        pool_status: "ok",
        fee_rate_status: "ok",
        estimated_fee_rate: "0x3e8",
        version_status: "unsupported",
      }),
    ).toMatchObject({
      status: "blocked",
      label: "Version unsupported",
      blocksBalanceQueries: false,
      blocksFundingActions: true,
    });
  });
});
