# RPC Connectivity Slice Gap Check

Date: 2026-05-31

## Knowledge Graph Availability

No knowledge graph tools, MCP resources, or local graph files were exposed in this session. This slice uses the generated Milestone 0 docs as its source-backed baseline.

## Implemented

- Added a Tauri `rpc_call` command for live Fiber JSON-RPC.
- Added a Rust-side MVP method allowlist from `docs/rpc-method-map.md`.
- Added endpoint validation:
  - only `http` and `https`
  - no embedded username/password credentials
- Added optional `Authorization: Bearer <token>` support.
- Added HTTP and JSON-RPC error mapping.
- Refined JSON-RPC auth and permission error mapping so HTTP 200 responses with Fiber auth failures are surfaced as `auth_required` or `permission_denied`.
- Added `npm run smoke:fiber-rpc` for local/live Fiber `node_info` probes; unauthenticated protected endpoints are reported as `auth_required` and accepted when no token is supplied.
- Kept mock RPC fixtures for web/test development.
- Added frontend profile-level RPC mode:
  - `mock`
  - `live`
- Added editable Fiber RPC endpoint.
- Added session-only Biscuit token input.

## Security Notes

- Biscuit tokens are not persisted in local storage in this slice.
- Live RPC calls remain limited to the 20 MVP methods.
- Raw console and advanced/dev methods remain out of scope.
- Endpoint credentials are rejected if embedded in the URL.

## Remaining Gaps

- Token storage still needs OS keychain/Stronghold.
- RPC params are allowlisted by method name but not schema-validated yet.
- Error mapping still needs broader live FNN fixtures for route, payment, channel, and malformed-param failures.
- Live FNN smoke coverage currently probes `node_info` only; broader channel, invoice, payment, and graph probes remain pending.
- Public/non-loopback endpoint warnings are not surfaced in UI yet.
