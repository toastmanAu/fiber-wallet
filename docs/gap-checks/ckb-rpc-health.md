# CKB RPC Health Gap Check

Date: 2026-06-01

## Knowledge Graph Check

No MCP knowledge graph resources or templates were exposed in this session. Gap checking used local source references:

- `docs/project-plan.md`
- `docs/gap-checks/profile-health-slice.md`
- `docs/config-schema.md`
- `apps/desktop/src-tauri/src/main.rs`
- `apps/desktop/src/features/onboarding/OnboardingPanel.tsx`

## Implemented

- Added backend `ckb_rpc_health` command using CKB JSON-RPC `get_tip_block_number`.
- Reused endpoint validation so only HTTP(S) CKB RPC endpoints are accepted.
- Added editable CKB RPC endpoint field in Profiles.
- Added separate CKB RPC health-check button and status output.
- Added Rust coverage for CKB endpoint validation.

## Verification

- Frontend typecheck validates Profiles UI command wiring.
- Rust tests validate endpoint handling and command registration through compilation.

## Remaining Gaps

- No live CKB RPC smoke test was executed in automated validation.
- Health check only probes `get_tip_block_number`; indexer/balance readiness is still pending.
- CKB endpoint auth/custom headers are not modeled.
