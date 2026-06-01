export type CkbRpcHealth = {
  status: string;
  tip_block_number?: unknown;
  indexer_status: "ok" | "unavailable" | string;
  indexer_tip_block_number?: unknown;
  indexer_tip_block_hash?: unknown;
  indexer_lag_blocks?: number | null;
  indexer_message?: string | null;
  pool_status?: "ok" | "unavailable" | string;
  tx_pool_info?: unknown;
  min_fee_rate?: unknown;
  estimated_fee_rate?: unknown;
  fee_rate_status?: "ok" | "fallback_to_pool_min" | "unavailable" | string;
  fee_rate_message?: string | null;
  ckb_node_version?: string | null;
  pinned_ckb_version?: string;
  version_status?: "ok" | "compatible" | "newer_unverified" | "unsupported" | "unknown" | "unavailable" | string;
  version_message?: string | null;
};

export type CkbIndexerReadiness =
  | {
      status: "ready";
      label: string;
      detail: string;
      blocksWalletQueries: false;
    }
  | {
      status: "stale" | "unavailable";
      label: string;
      detail: string;
      blocksWalletQueries: true;
    };

export type CkbActionGate = {
  status: "mock" | "checking" | "ready" | "warning" | "blocked";
  label: string;
  detail: string;
  blocksBalanceQueries: boolean;
  blocksFundingActions: boolean;
};

export const STALE_INDEXER_LAG_BLOCKS = 16;

type Readiness = {
  status: "ready" | "warning" | "blocked";
  label: string;
  detail: string;
  blocksFunding: boolean;
};

export function classifyCkbIndexerReadiness(health: CkbRpcHealth): CkbIndexerReadiness {
  if (health.indexer_status !== "ok") {
    return {
      status: "unavailable",
      label: "Indexer unavailable",
      detail:
        health.indexer_message ??
        "Wallet balance queries and cell lookups require a CKB endpoint with the indexer module enabled.",
      blocksWalletQueries: true,
    };
  }

  if (typeof health.indexer_lag_blocks === "number" && health.indexer_lag_blocks > STALE_INDEXER_LAG_BLOCKS) {
    return {
      status: "stale",
      label: "Indexer stale",
      detail: `Indexer is ${health.indexer_lag_blocks} blocks behind chain tip. Wallet balances may be stale until it catches up.`,
      blocksWalletQueries: true,
    };
  }

  return {
    status: "ready",
    label: "Indexer ready",
    detail: formatIndexerSummary(health),
    blocksWalletQueries: false,
  };
}

export function classifyCkbFeeReadiness(health: CkbRpcHealth): Readiness {
  if (health.pool_status !== "ok") {
    return {
      status: "blocked",
      label: "Pool unavailable",
      detail:
        health.fee_rate_message ??
        "Funding transaction submission and fee checks require a CKB endpoint with the Pool module enabled.",
      blocksFunding: true,
    };
  }

  if (health.fee_rate_status === "ok") {
    return {
      status: "ready",
      label: "Fee estimate ready",
      detail: `estimate_fee_rate ${formatRpcQuantity(health.estimated_fee_rate)} shannons/kB`,
      blocksFunding: false,
    };
  }

  if (health.fee_rate_status === "fallback_to_pool_min") {
    return {
      status: "warning",
      label: "Fee estimate fallback",
      detail: `Using tx_pool_info.min_fee_rate ${formatRpcQuantity(health.min_fee_rate)} shannons/kB as the floor.`,
      blocksFunding: false,
    };
  }

  return {
    status: "blocked",
    label: "Fee readiness unknown",
    detail:
      health.fee_rate_message ??
      "Fee readiness could not be checked. Funding actions should stay disabled until Pool RPC is available.",
    blocksFunding: true,
  };
}

export function classifyCkbVersionReadiness(health: CkbRpcHealth): Readiness {
  if (health.version_status === "ok") {
    return {
      status: "ready",
      label: "Version pinned",
      detail: `CKB ${health.ckb_node_version ?? health.pinned_ckb_version ?? "unknown"}`,
      blocksFunding: false,
    };
  }

  if (health.version_status === "compatible") {
    return {
      status: "ready",
      label: "Version compatible",
      detail:
        health.version_message ??
        `CKB node is compatible with pinned baseline ${health.pinned_ckb_version ?? "unknown"}.`,
      blocksFunding: false,
    };
  }

  if (health.version_status === "newer_unverified") {
    return {
      status: "warning",
      label: "Version unverified",
      detail:
        health.version_message ??
        `CKB node is newer than pinned baseline ${health.pinned_ckb_version ?? "unknown"} and has not been verified.`,
      blocksFunding: false,
    };
  }

  if (health.version_status === "unsupported") {
    return {
      status: "blocked",
      label: "Version unsupported",
      detail:
        health.version_message ??
        `CKB node is below the supported baseline ${health.pinned_ckb_version ?? "unknown"}.`,
      blocksFunding: true,
    };
  }

  return {
    status: "warning",
    label: "Version unchecked",
    detail:
      health.version_message ??
      "CKB node version compatibility could not be checked against the pinned source baseline.",
    blocksFunding: false,
  };
}

export function buildCkbActionGate(
  rpcMode: string,
  health?: CkbRpcHealth,
  healthError?: unknown,
): CkbActionGate {
  if (rpcMode !== "live") {
    return {
      status: "mock",
      label: "Mock CKB checks",
      detail: "Live CKB readiness checks are skipped for mock profiles.",
      blocksBalanceQueries: false,
      blocksFundingActions: false,
    };
  }

  if (healthError) {
    return {
      status: "blocked",
      label: "CKB health failed",
      detail: formatHealthError(healthError),
      blocksBalanceQueries: true,
      blocksFundingActions: true,
    };
  }

  if (!health) {
    return {
      status: "checking",
      label: "Checking CKB readiness",
      detail: "Waiting for CKB chain, indexer, Pool, fee, and version probes.",
      blocksBalanceQueries: true,
      blocksFundingActions: true,
    };
  }

  const indexer = classifyCkbIndexerReadiness(health);
  const fee = classifyCkbFeeReadiness(health);
  const version = classifyCkbVersionReadiness(health);

  if (indexer.blocksWalletQueries) {
    return {
      status: "blocked",
      label: indexer.label,
      detail: indexer.detail,
      blocksBalanceQueries: true,
      blocksFundingActions: true,
    };
  }

  if (fee.blocksFunding) {
    return {
      status: "blocked",
      label: fee.label,
      detail: fee.detail,
      blocksBalanceQueries: false,
      blocksFundingActions: true,
    };
  }

  if (version.blocksFunding) {
    return {
      status: "blocked",
      label: version.label,
      detail: version.detail,
      blocksBalanceQueries: false,
      blocksFundingActions: true,
    };
  }

  if (fee.status === "warning" || version.status === "warning") {
    return {
      status: "warning",
      label: fee.status === "warning" ? fee.label : version.label,
      detail: fee.status === "warning" ? fee.detail : version.detail,
      blocksBalanceQueries: false,
      blocksFundingActions: false,
    };
  }

  return {
    status: "ready",
    label: "CKB ready",
    detail: "Indexer, Pool, fee, and version checks are ready for balance and funding work.",
    blocksBalanceQueries: false,
    blocksFundingActions: false,
  };
}

export function formatIndexerSummary(health: CkbRpcHealth): string {
  if (health.indexer_status !== "ok") {
    return `indexer ${health.indexer_status}`;
  }

  const tip = String(health.indexer_tip_block_number ?? "unknown");
  if (typeof health.indexer_lag_blocks === "number") {
    return `indexer ok / tip ${tip} / lag ${health.indexer_lag_blocks}`;
  }

  return `indexer ok / tip ${tip}`;
}

export function formatRpcQuantity(value: unknown): string {
  if (typeof value !== "string") {
    return "unknown";
  }

  if (!value.startsWith("0x")) {
    return value;
  }

  const parsed = Number.parseInt(value.slice(2), 16);
  return Number.isFinite(parsed) ? String(parsed) : value;
}

function formatHealthError(error: unknown): string {
  if (error && typeof error === "object" && "kind" in error && "message" in error) {
    const typed = error as { kind: unknown; message: unknown };
    return `${String(typed.kind)}: ${String(typed.message)}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
