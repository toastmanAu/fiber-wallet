# Phase 1 Write-up

Date: 2026-05-31

## Summary

Phase 1 established the public repository and the first runnable desktop application skeleton for Fiber Wallet.

Repository:
- Public GitHub repo: <https://github.com/toastmanAu/fiber-wallet>
- Local repo: `/home/phill/fiber-web/fiber-wallet`
- Initial commit: `aa895a7 Scaffold phase 1 desktop app`

The scaffold follows the revised project plan in `docs/project-plan.md`. It intentionally stops short of live Fiber RPC and wallet/key generation until the source corpus, version pins, and gap checks are completed.

## What Was Built

Application foundation:
- Tauri 2 desktop shell.
- React 19 + TypeScript + Vite frontend.
- npm workspace layout.
- Rust Tauri command layer with initial mock commands.
- Tauri app configuration, capabilities file, and placeholder app icon.

Frontend shell:
- Persistent desktop sidebar navigation.
- Dashboard page with mocked node, auth, peer, and channel status cards.
- Profile panel with locally persisted non-secret profile metadata.
- Responsive layout for narrower viewports.
- Initial cyberpunk-operational visual style using restrained dark UI, cyan/magenta accents, and compact dashboard panels.

State and RPC scaffolding:
- Zustand profile store.
- TanStack Query on the dashboard.
- Mock RPC fixture module for `node_info`, `list_peers`, and `list_channels`.
- Frontend `fiberRpc` wrapper currently routed to the mock Tauri command.
- Query key helper module.

Security scaffolding:
- Secret backend status command returning an explicit stub provider.
- Redaction utility for bearer tokens, private-key-like values, Fiber unlock passwords, and BIP39 recovery phrases.
- Redaction tests.

Wallet/key requirements captured:
- PQR lock algorithm option model with:
  - `mldsa`
  - `spincs`
  - `falcon`
- BIP39 recovery format modeled in profile metadata.
- Project plan updated to require PQR lock profile support and BIP39 import/export flows before wallet implementation.

Documentation:
- Revised project plan copied into `docs/project-plan.md`.
- Reference manifest placeholder added at `docs/references/manifest.md`.
- Milestone 1 gap check added at `docs/gap-checks/milestone-1.md`.

## Validation

The following checks passed locally:

```bash
npm run lint
npm test
npm run build:web
cargo check
```

Test status:
- 2 test files passed.
- 5 tests passed.

The Vite dev server was started successfully at:

```text
http://127.0.0.1:1420/
```

## Known Gaps

These are intentionally deferred and recorded in the gap check:

- No pinned Fiber/FNN source version yet.
- No generated RPC method map yet.
- No generated Biscuit permission map yet.
- No verified FNN config schema yet.
- No bundled `fnn` sidecar yet.
- No live Fiber RPC calls yet.
- No actual wallet key generation/import/export yet.
- PQR lock script support for ML-DSA, SPHINCS+, and Falcon still needs source validation.
- BIP39 derivation path, entropy strength, PQR lock binding, and encrypted backup format still need specification.
- Knowledge graph resources were not available in this session, so gap checking used direct plan/source review only.

## Next Milestone

Before implementing live node or wallet behavior, complete Milestone 0:

- Ingest or fetch pinned source repositories.
- Record exact commits and versions in `docs/references/manifest.md`.
- Generate `docs/rpc-method-map.md`.
- Generate `docs/rpc-permission-map.md`.
- Generate `docs/config-schema.md`.
- Add `docs/gap-checks/milestone-0.md`.
- Verify PQR and BIP39 requirements against pinned CKB/Fiber sources.

After Milestone 0, proceed into the live RPC connectivity vertical slice:

- Replace mock-only RPC path with a guarded `rpc_call` command.
- Add endpoint and token settings.
- Implement method allowlist.
- Render live `node_info`.
- Keep mocks for tests and offline development.
