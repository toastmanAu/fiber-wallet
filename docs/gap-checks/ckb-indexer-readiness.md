# CKB Indexer Readiness Gap Check

Date: 2026-06-01

## Knowledge Graph Check

No MCP knowledge graph resources or templates were exposed in this session. Gap checking used local source references:

- `docs/project-plan.md`
- `docs/gap-checks/ckb-rpc-health.md`
- `apps/desktop/src-tauri/src/main.rs`
- `apps/desktop/src/features/onboarding/OnboardingPanel.tsx`

## Implemented

- Extended the backend `ckb_rpc_health` command to call CKB JSON-RPC `get_indexer_tip` in addition to `get_tip_block_number`.
- Added an `indexer_status` field with values `ok` or `unavailable`, plus `indexer_tip_block_number`, `indexer_tip_block_hash`, `indexer_lag_blocks`, and `indexer_message` to the `CkbRpcHealth` payload.
- Treat indexer failure as a soft failure: the overall health status stays `ok` so users on a chain-only RPC still see useful tip information, while the indexer fields explicitly mark the gap that blocks wallet balance queries.
- Extracted `parse_ckb_block_number` and `compute_indexer_lag` as pure helpers so the hex parsing and lag math are unit-testable without a mock HTTP server.
- Extracted a shared `ckb_rpc_call` helper for the JSON-RPC round-trip so adding probes does not duplicate transport, status, and error mapping.
- Updated the Profiles onboarding panel to render indexer status and lag inline with the tip number, and to surface a danger-styled warning sub-row when the indexer is unavailable or more than 16 blocks behind tip.
- Added Rust unit tests for hex and decimal block-number parsing, positive indexer lag, and negative-lag anomalies.

## Verification

- `cargo check` and `cargo test` pass for `fiber-wallet-desktop` (16 tests, 16 pass).
- `npm run lint` (frontend tsc) passes.
- `npm test` passes (38 tests across 10 files).
- `npm run build:web` produces a successful Vite production build.

## Remaining Gaps

- Still no live CKB RPC smoke test in CI; the indexer probe has only been exercised against pure-function unit tests so far.
- The 16-block "stale indexer" threshold is a placeholder derived from typical CKB block intervals (~10s) — it is not yet calibrated against pinned Fiber/CKB operator guidance.
- The dashboard wallet card does not yet consume `indexer_status` to gate balance queries. The Profiles panel surfaces the gap, but other features that depend on indexer data still assume it is available.
- CKB endpoint auth/custom headers remain unmodeled; both the tip and indexer probes still issue unauthenticated requests.
- No equivalent probe exists yet for the CKB `Pool` module (needed for fee estimation) or for verifying that the running CKB version is within the pinned supported range.
