# Invoice and Payment Foundation Gap Check

Date: 2026-06-01

## Knowledge Graph Check

No MCP knowledge graph resources were exposed in this session. Gap checking used local generated docs and Fiber source references:

- `docs/rpc-method-map.md`
- `docs/rpc-permission-map.md`
- `references/fiber/crates/fiber-lib/src/rpc/invoice.rs`
- `references/fiber/crates/fiber-lib/src/rpc/payment.rs`
- `references/fiber/crates/fiber-lib/src/rpc/README.md`
- `references/fiber/crates/fiber-cli/src/tests.rs`

## Implemented

- Added a Payments view covering invoice creation, parsing, lookup, and cancellation.
- Added payment preview using `send_payment` with `dry_run: true`.
- Added payment send for invoice or target-pubkey/keysend paths.
- Added payment history with status filtering through `list_payments`.
- Extended mock RPC for invoices, payment dry runs, sent payments, and payment history.
- Added frontend tests for the mock invoice and payment flow.

## Verification

- Frontend typecheck validates the new Payments view and RPC parameter shapes.
- Frontend unit tests cover invoice creation, dry-run preview, send, and list payments in mock mode.
- Existing backend RPC allowlist already includes the Milestone 7 invoice/payment methods.

## Remaining Gaps

- No live controlled testnet payment was executed in this slice.
- Route preview currently uses `send_payment` dry-run; manual `build_router` and `send_payment_with_router` workflows are not exposed yet.
- Payment timeline is a compact history list, not a full event timeline.
- Graph-stale and route-not-found states depend on live FNN error payloads and are surfaced as generic RPC errors for now.
- Invoice advanced fields such as UDT scripts, payment preimage/hash, fallback address, MPP, and trampoline routing are not exposed yet.
