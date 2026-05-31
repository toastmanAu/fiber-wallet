# Graph and Diagnostics Foundation Gap Check

Date: 2026-06-01

## Knowledge Graph Check

No MCP knowledge graph resources were exposed in this session. Gap checking used local generated docs and Fiber source references:

- `docs/rpc-method-map.md`
- `docs/rpc-permission-map.md`
- `references/fiber/crates/fiber-lib/src/rpc/graph.rs`
- `references/fiber/crates/fiber-lib/src/rpc/README.md`
- Existing app redaction and node log commands.

## Implemented

- Added a Graph view backed by `graph_nodes` and `graph_channels`.
- Added a simple graph renderer that works with mock graph nodes/channels and live RPC responses that expose compatible pubkey/channel fields.
- Added graph node/channel lists with refresh controls.
- Added redacted diagnostic bundle generation with app version, profile metadata, graph counts, recent node logs, and gap-check baseline paths.
- Added browser download for the diagnostic JSON bundle.
- Extended mock RPC with graph node/channel fixtures.
- Fixed the shared redaction callback so secrets later in JSON strings are not corrupted by regex offset arguments.

## Verification

- Frontend typecheck validates the graph diagnostics view.
- Frontend unit tests cover diagnostic bundle redaction and JSON parseability.
- Existing Rust tests cover the backend app version and redacted node log command surface indirectly through compilation and command registration.

## Remaining Gaps

- No live graph RPC smoke test was executed in this slice.
- The graph renderer is a compact foundation, not a force-directed topology explorer.
- Diagnostics bundle does not yet include config-file contents or RPC health probes beyond current graph query status.
- The download path uses browser blob download; native save-dialog integration is still pending.
- Bundle redaction covers current shared secret patterns, but should be expanded as new secret formats are added.
