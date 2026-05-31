# Milestone 1 Gap Check

Date: 2026-05-31

## Knowledge Graph Availability

No knowledge graph tools, MCP resources, or local graph files are exposed in this session. This milestone uses the revised project plan and direct source checks performed before the scaffold.

## Scope

Milestone 1 is limited to desktop skeleton work:
- Tauri 2 + React + TypeScript app shell.
- Layout/navigation.
- Mock profile state.
- Mock RPC fixtures.
- Secret backend abstraction stub.
- Baseline tests.

## Deferred Gaps

- Pinned Fiber/FNN release and RPC docs are still pending.
- Exact RPC permission map is still pending.
- FNN config schema is still pending.
- PQR lock key generation is now a wallet requirement; ML-DSA, SPHINCS+, and Falcon lock script support must be verified against pinned CKB/Fiber sources before implementation.
- BIP39 import/export is now a wallet requirement; derivation path, entropy strength, PQR lock binding, and encrypted backup format must be specified before implementation.
- Sidecar binary packaging is represented by config scaffolding only; no `fnn` sidecar is bundled yet.
- Live RPC behavior is intentionally blocked until Milestone 0 artifacts are generated.
