# CKB Fee and Version Readiness Gap Check

Date: 2026-06-01

## Knowledge Graph Check

No MCP knowledge graph resources were exposed in this session. Gap checking used local pinned source references:

- `references/ckb/rpc/src/module/pool.rs`
- `references/ckb/rpc/src/module/experiment.rs`
- `references/ckb/rpc/src/module/net.rs`
- `references/ckb/util/jsonrpc-types/src/pool.rs`
- `references/ckb/Cargo.toml`
- `docs/references/manifest.md`
- `docs/gap-checks/ckb-indexer-readiness.md`

## Source Findings

- CKB `Pool` RPC exposes `tx_pool_info`, including `min_fee_rate`, `min_rbf_rate`, pool counts, limits, and tip fields.
- CKB `Experiment` RPC exposes `estimate_fee_rate`; it returns a fee rate in shannons per kilobyte and accepts optional `estimate_mode` and `enable_fallback` params.
- CKB `Net` RPC exposes `local_node_info`, including the running node `version`.
- CKB Indexer RPC exposes `get_cells(search_key, order, limit, after)`. The pinned docs model `limit` as `Uint32`; examples pass it as a hex quantity such as `"0x64"`.
- CKB Indexer RPC exposes `get_cells_capacity(search_key)` for total live-cell capacity at the indexed tip.
- The pinned local CKB source baseline is `0.206.0` from `references/ckb/Cargo.toml`.

## CKB Version Policy

- Pinned baseline: `0.206.0`.
- Minimum supported version for live funding actions: `0.206.0`.
- `0.206.x` patch versions at or above the baseline are treated as compatible.
- Newer `0.x` minor versions are treated as newer/unverified: the UI warns but does not block funding.
- Older versions and different major versions are unsupported and block live funding actions until verified.

## Implemented

- Extended backend `ckb_rpc_health` with soft probes for:
  - `tx_pool_info`
  - `estimate_fee_rate`
  - `local_node_info`
- Added health payload fields for Pool status, tx-pool info, min fee rate, estimated fee rate, CKB node version, pinned CKB version, version status, and probe messages.
- Kept the base CKB health check anchored on `get_tip_block_number`; Pool, fee estimation, and version failures are reported as readiness fields rather than failing the whole health command.
- Added Rust version parsing/status helpers and unit tests for pinned, mismatched, missing, and malformed CKB versions.
- Added frontend readiness classifiers for fee readiness and CKB version readiness.
- Added Dashboard cards for `Fees` and `CKB Version` beside the existing wallet/indexer readiness card.
- Updated the Profiles CKB health check summary to include fee and version readiness labels.
- Added frontend tests for fee readiness, version readiness, and hex quantity formatting.
- Added a shared frontend CKB action gate that combines live CKB health, indexer readiness, Pool/fee readiness, and version warnings.
- Channel open, accept, and shutdown controls now consume the shared funding-action gate.
- External funding open and signed funding submit controls now consume the shared funding-action gate.
- Added a Wallet-panel CKB live-cell workbench that consumes the shared balance-query gate, accepts a known lock script, calls indexer `get_cells` with exact script search and hex `Uint32` limit, carries the result cursor, and summarizes current-page capacity.
- Extended the workbench command to call `get_cells_capacity` for total indexed capacity at the indexer tip, so the UI can distinguish returned-page capacity from full lock-script capacity.
- Added backend `ckb_live_cells` with lock-script validation, bounded result limits, CKB capacity parsing, and CKB-denominated capacity formatting.
- Mock profiles remain usable for offline workflow development while live profiles block funding actions until required CKB probes are ready.
- Added backend CKB version policy classification for pinned, compatible patch, newer-unverified, unsupported, unknown, and unavailable versions.
- Updated frontend version readiness so unsupported versions block funding actions while compatible patches pass and newer unverified versions warn.

## Verification

- `cargo fmt --check` passes.
- `cargo test` passes (26 tests, 26 pass).
- `npm run lint` passes.
- `npm test` passes (61 tests across 13 files).
- `npm run build:web` produces a successful Vite production build.
- Added `npm run smoke:ckb-health` for live CKB RPC smoke checks.
- Live smoke against `https://testnet.ckbapp.dev/` passed on 2026-06-01:
  - `get_tip_block_number`: ok, tip `0x144b38d`
  - `get_indexer_tip`: ok, block `0x144b38d`
  - `tx_pool_info`: ok, `min_fee_rate` `0x3e8`
  - `estimate_fee_rate`: ok, `0x3e8`
  - `local_node_info`: ok, version `0.206.0 (2c91814 2026-05-06)`

## Remaining Gaps

- `estimate_fee_rate` is part of the CKB Experiment module; if disabled, the UI currently falls back to `tx_pool_info.min_fee_rate` as a floor but does not yet model richer fee policy.
- The supported-version policy is conservative and source-pinned, but newer minor releases still need explicit verification before changing from warning to compatible.
- CKB endpoint auth/custom headers remain unmodeled.
- No live UI exercise was performed against an endpoint where CKB readiness transitions from blocked to ready.
- Live-cell querying still requires a manually supplied lock script; FNN key-to-lock/address derivation and full wallet balance aggregation remain pending.
