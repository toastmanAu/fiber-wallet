# Current Status

Date: 2026-06-03

## Repository

- Local repo: `/home/phill/fiber-web/fiber-wallet`
- Branch: `main`
- Local branch state before this docs update: clean and 5 commits ahead of `origin/main`
- Latest feature commit before this docs update: `b29a95a Persist CKB lock metadata`

## Verification

The current checkpoint passes:

```bash
npm run lint
npm test
npm run build:web
```

Observed test count on 2026-06-03:

- 13 Vitest files passed
- 61 tests passed

## Implemented Slices

The project is beyond the initial Phase 1 desktop skeleton. Implemented source-backed slices now include:

- Milestone 0 source-backed generated docs and gap checks.
- Guarded Fiber RPC connectivity foundations with endpoint safety checks.
- Profile health and CKB RPC health probes.
- CKB indexer readiness and fee/version readiness helpers.
- Raw JSON-RPC console allowlist, parameter validation, and write confirmations.
- Biscuit auth policy foundations and FiberConnect mobile pairing scope checks.
- Local node manager preflight foundations.
- Wallet key import, encrypted backup, backup validation, restore foundations, and CKB lock metadata persistence.
- Peers and channels foundations, including channel accept/update support.
- Invoice/payment foundations, manual route support, timeline helpers, and failure-state classification.
- Graph diagnostics and redacted diagnostic bundle generation.
- External signer and funding-flow foundations.

## Runtime Notes

- A local `fiber-dt.service` was active during the 2026-06-03 status check.
- `http://127.0.0.1:8231` responded to JSON-RPC, but unauthenticated `node_info` returned `Unauthorized`.
- Live Fiber calls therefore require a valid Biscuit token for that local node configuration.

## Remaining Work

The main remaining gaps are runtime integration and end-to-end validation:

- Full managed-node sidecar packaging and lifecycle are not complete.
- New wallet key generation and BIP39 recovery flows are still pending.
- PQR lock generation remains modeled but not fully source-verified or implemented.
- Live CKB/Fiber smoke coverage is limited; most checks currently rely on unit tests and guarded local probes.
- README and historical milestone docs should stay synchronized as new slices land.
