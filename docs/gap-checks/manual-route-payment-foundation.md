# Manual Route Payment Foundation Gap Check

Date: 2026-06-01

## Knowledge Graph Check

No MCP knowledge graph resources or templates were exposed in this session. Gap checking used local source references:

- `docs/project-plan.md`
- `docs/rpc-method-map.md`
- `docs/gap-checks/invoice-payment-foundation.md`
- `references/fiber/crates/fiber-lib/src/rpc/payment.rs`
- `references/fiber/crates/fiber-lib/src/rpc/README.md`
- `apps/desktop/src/features/payments/PaymentsPanel.tsx`

## Implemented

- Added a manual route workbench to the Payments view.
- Added `build_router` inputs for amount, hops info JSON, and final TLC expiry delta.
- Added router JSON display/editing for advanced route workflows.
- Added `send_payment_with_router` dry-run preview and confirmed send flow.
- Extended mock RPC for route building and router-based payment send.
- Added tests for the mocked build-router and send-with-router flow.

## Verification

- Frontend typecheck validates the new route UI and RPC parameter construction.
- Unit tests cover mock route build, dry-run router send, and confirmed router send persistence.

## Remaining Gaps

- No live controlled testnet route build or router send was executed.
- Hops info and router inputs are still raw JSON fields without schema-aware editing.
- Route-not-found and graph-stale errors are still surfaced from RPC payloads rather than normalized into dedicated UI states.
- Advanced UDT/custom-record/trampoline route fields remain raw-console-only.
