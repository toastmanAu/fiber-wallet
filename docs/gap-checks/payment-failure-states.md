# Payment Failure States Gap Check

Date: 2026-06-01

## Knowledge Graph Check

No MCP knowledge graph resources or templates were exposed in this session. Gap checking used local source references:

- `docs/project-plan.md`
- `docs/gap-checks/invoice-payment-foundation.md`
- `docs/gap-checks/manual-route-payment-foundation.md`
- `apps/desktop/src/features/payments/PaymentsPanel.tsx`
- `apps/desktop/src/lib/paymentFailures.ts`

## Implemented

- Added payment failure classification for route-not-found and stale-graph errors.
- Wired classified messages into payment preview, send, router-send, and history display paths.
- Kept unknown payment errors visible instead of hiding raw RPC detail.
- Added unit tests for route-not-found, graph-stale, and generic payment-failure classification.

## Verification

- Frontend typecheck validates the payment failure helper and UI wiring.
- Unit tests cover the main classified failure states.

## Remaining Gaps

- Classification is based on current known Fiber error text patterns; live FNN error payloads may require additional mappings.
- The Graph screen is not automatically refreshed from a graph-stale payment state yet.
- No live controlled testnet payment failure was executed.
