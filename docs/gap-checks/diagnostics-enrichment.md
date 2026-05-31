# Diagnostics Enrichment Gap Check

Date: 2026-06-01

## Knowledge Graph Check

No MCP knowledge graph resources or templates were exposed in this session. Gap checking used local source references:

- `docs/project-plan.md`
- `docs/gap-checks/graph-diagnostics-foundation.md`
- `apps/desktop/src/features/graph/GraphDiagnosticsPanel.tsx`
- `apps/desktop/src/lib/diagnostics.ts`
- `apps/desktop/src-tauri/src/main.rs`

## Implemented

- Added a bounded `node_read_config` backend command for diagnostic config snapshots.
- Added redacted config contents to diagnostic bundles.
- Added explicit diagnostic RPC probes for `node_info`, `graph_nodes`, and `graph_channels`.
- Added RPC health summary and detailed per-method health fields to the bundle.
- Added tests for config snapshot redaction and diagnostic bundle redaction.

## Verification

- Frontend typecheck validates diagnostic bundle shape and RPC probe wiring.
- Frontend unit tests verify diagnostic JSON remains parseable and secrets are redacted.
- Rust tests verify config snapshots are bounded and redacted.

## Remaining Gaps

- No live FNN graph/RPC smoke test was executed.
- Config snapshots are raw redacted text, not structured config analysis.
- RPC probes cover core node/graph health only; channel, invoice, payment, and external funding smoke probes remain future work.
- Native save-dialog integration for diagnostics is still pending.
