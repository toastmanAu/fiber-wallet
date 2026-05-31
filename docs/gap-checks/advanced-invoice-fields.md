# Advanced Invoice Fields Gap Check

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

- Exposed advanced `new_invoice` inputs for payment preimage/hash, fallback address, final expiry delta, UDT type script, MPP, and trampoline routing.
- Added guarded JSON-object parsing for optional UDT type script input.
- Extended mock invoice storage to preserve advanced invoice fields.
- Added tests for advanced mock invoice fields.

## Verification

- Frontend typecheck validates the advanced invoice RPC parameter construction.
- Unit tests cover preservation of advanced invoice fields in mock mode.

## Remaining Gaps

- Advanced fields are still raw inputs; script/hash values do not yet have schema-aware validation.
- Hold-invoice semantics are not explained beyond the separate preimage/hash fields.
- No live controlled testnet advanced invoice was created.
