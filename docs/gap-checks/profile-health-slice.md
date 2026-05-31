# Profile Health Slice Gap Check

Date: 2026-05-31

## Knowledge Graph Availability

No knowledge graph tools, MCP resources, or local graph files were exposed in this session. This slice uses the Milestone 0 config/RPC/auth docs as its baseline.

## Implemented

- Added frontend endpoint safety classification:
  - invalid
  - loopback
  - private network
  - public
- Blocked live RPC calls to public endpoints when no session Biscuit token is present.
- Rejected invalid endpoint URLs before live RPC calls.
- Added visible profile-panel endpoint safety state.
- Added profile-panel `node_info` health check.
- Kept Biscuit token session-only.

## Security Notes

- Public RPC without Biscuit auth is blocked in the frontend RPC wrapper.
- Rust still validates endpoint scheme and rejects embedded credentials.
- UI warning state and RPC call blocking share the same frontend classification helper.

## Remaining Gaps

- Public/private host classification is frontend-side only; Rust should enforce the same policy before shipping.
- Token persistence still needs OS keychain/Stronghold.
- Health checks only cover Fiber `node_info`; CKB RPC, data-dir, and sidecar checks are still pending.
- No live FNN smoke test is committed yet.
