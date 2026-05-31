# Raw Console Write Confirmations Gap Check

Date: 2026-06-01

## Knowledge Graph Check

No MCP knowledge graph resources or templates were exposed in this session. Gap checking used local source references:

- `docs/project-plan.md`
- `docs/rpc-method-map.md`
- `docs/rpc-permission-map.md`
- `apps/desktop/src/features/terminal/JsonRpcConsole.tsx`
- `apps/desktop/src/features/terminal/consoleUtils.ts`
- `apps/desktop/src/lib/allowedRpcMethods.ts`

## Implemented

- Classified raw-console write methods that can mutate peer, channel, invoice, payment, or signing state.
- Added explicit confirmation before sending classified raw RPC methods.
- Kept read-only raw RPC methods as direct sends.
- Added method-classification and confirmation-preview tests.

## Verification

- Frontend typecheck validates console confirmation wiring.
- Unit tests cover write-method classification and read-method pass-through.

## Remaining Gaps

- Raw console confirmation is method-based and does not inspect semantic risk inside arbitrary params.
- Raw console still allows operator write methods when the active token/profile permits them.
- No live FNN smoke test has been run for confirmed raw write calls.
