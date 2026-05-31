# Write Confirmation Guardrails Gap Check

Date: 2026-06-01

## Knowledge Graph Check

No MCP knowledge graph resources or templates were exposed in this session. Gap checking used local source references:

- `docs/project-plan.md`
- `docs/rpc-method-map.md`
- `apps/desktop/src/features/channels/ChannelsPanel.tsx`
- `apps/desktop/src/features/payments/PaymentsPanel.tsx`
- `apps/desktop/src/features/external/ExternalSignerPanel.tsx`

## Implemented

- Added a reusable confirmation dialog for high-risk write actions.
- Added explicit confirmation before `open_channel`.
- Kept the existing typed `shutdown` guard and added a second confirmation before `shutdown_channel`.
- Added explicit confirmation before non-dry-run `send_payment`.
- Added confirmations before `open_channel_with_external_funding` and `submit_signed_funding_tx`.
- Added confirmation dialog tests.

## Verification

- Frontend typecheck covers the wired confirmation props and action callbacks.
- Unit tests cover that the reusable dialog shows action details before invoking the confirmed callback.

## Remaining Gaps

- Confirmations do not yet require re-authentication or OS keychain unlock.
- Fee/reserved-capacity values are still limited by what the current screens know before live balance and route APIs are added.
- The raw JSON-RPC console still allows guarded write methods for operator workflows; it relies on allowlists and endpoint/auth checks rather than per-method confirmation.
