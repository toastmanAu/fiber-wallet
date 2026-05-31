# Backend RPC Safety Slice Gap Check

Date: 2026-05-31

## Knowledge Graph Availability

No knowledge graph tools, MCP resources, or local graph files were exposed in this session. This slice closes a gap recorded in `profile-health-slice.md`.

## Implemented

- Mirrored endpoint safety enforcement in the Tauri Rust backend.
- `rpc_call` now blocks public RPC endpoints without a Biscuit token before creating an HTTP request.
- Rust endpoint validation still rejects:
  - non-HTTP(S) schemes
  - embedded URL credentials
  - missing hosts
- Added Rust unit tests for:
  - invalid endpoint rejection
  - loopback classification
  - private IPv4 / unique-local IPv6 classification
  - public endpoint auth enforcement

## Security Notes

- Frontend and backend both enforce public RPC auth requirements.
- Backend remains the authoritative guard for actual live RPC calls.
- Private-network RPC is allowed without a token for now, matching the current product plan; public/non-loopback remote use should still prefer Biscuit auth.

## Remaining Gaps

- Endpoint classifier is duplicated between TypeScript and Rust; it should eventually be generated/shared or tested from common fixtures.
- Token storage still needs OS keychain/Stronghold.
- No live FNN smoke test is committed yet.
