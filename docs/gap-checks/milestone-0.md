# Milestone 0 Gap Check

Generated: 2026-05-31

## Knowledge Graph Availability

No knowledge graph tools, MCP resources, or local graph files were exposed in this session. Gap checking used the pinned local source corpus in `references/`.

## Source Coverage

- Fiber RPC README parsed: yes.
- Fiber Biscuit authorization source parsed: yes.
- Fiber testnet/mainnet config files found: yes.
- CCC reference pinned: yes.
- JoyID SDK reference pinned: yes.
- CKB reference pinned: yes.

## MVP RPC Method Coverage

- MVP methods planned: 20
- RPC methods parsed from Fiber docs: 41
- Missing MVP methods in Fiber RPC docs: none
- Missing MVP permissions in Biscuit source: none

## Source Mismatches

- Biscuit source contains permission methods not present in generated RPC README: `subscribe_store_changes`.
- `subscribe_store_changes` is present in Biscuit permissions but not in the generated RPC README. Treat it as unsupported in the UI until source docs confirm the method surface.

## Security Requirements Confirmed

- Public RPC without Biscuit auth must be blocked because Fiber refuses unauthenticated public bind.
- `FIBER_SECRET_KEY_PASSWORD` is mandatory for local FNN startup with built-in wallet key material.
- CKB CLI exported key files must be reduced to the first private-key line for FNN and the exported source file should be removed after extraction.
- Node upgrades are risky while channels are open; UI must keep the close/backup warnings from the project plan.

## Open Gaps Before Live Wallet Work

- PQR lock script support for ML-DSA, SPHINCS+, and Falcon still needs verification against CKB/Fiber lock script sources.
- BIP39 derivation path, entropy strength, PQR lock binding, and encrypted backup format are still unspecified.
- Tauri sidecar binary packaging remains scaffold-only; no `fnn` binary is bundled.
- RPC method parameter validation is documented but not generated as TypeScript/Rust schemas yet.
- Live Fiber RPC tests require a pinned FNN binary or build pipeline.
