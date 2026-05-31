# Payment Timeline Foundation Gap Check

Date: 2026-06-01

## Knowledge Graph Check

No MCP knowledge graph resources or templates were exposed in this session. Gap checking used local source references:

- `docs/project-plan.md`
- `docs/gap-checks/invoice-payment-foundation.md`
- `apps/desktop/src/features/payments/PaymentsPanel.tsx`
- `apps/desktop/src/lib/paymentTimeline.ts`

## Implemented

- Added a payment timeline builder for created, routing, pending, and final states.
- Added selected-payment timeline rendering in the Payments history area.
- Updated send and router-send flows to seed the selected payment timeline from the latest RPC result.
- Added unit tests for successful and failed payment timelines.

## Verification

- Frontend typecheck validates the timeline wiring and state model.
- Unit tests cover successful and failed timeline construction.

## Remaining Gaps

- Timeline events are derived from the current payment summary response rather than a live event stream.
- Fiber status variants beyond the currently observed strings may need additional mappings.
- No live controlled testnet payment timeline was captured.
