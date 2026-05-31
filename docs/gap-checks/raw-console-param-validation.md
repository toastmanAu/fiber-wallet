# Raw Console Parameter Validation Gap Check

Date: 2026-06-01

## Knowledge Graph Check

No MCP knowledge graph resources or templates were exposed in this session. Gap checking used local source references:

- `docs/project-plan.md`
- `docs/rpc-method-map.md`
- `docs/gap-checks/raw-console-slice.md`
- `apps/desktop/src/features/terminal/JsonRpcConsole.tsx`
- `apps/desktop/src/features/terminal/consoleUtils.ts`

## Implemented

- Added first-pass method-specific parameter validation for the raw RPC console.
- Required core fields for peer, channel, invoice, payment, graph, and external funding methods.
- Added array checks for route-related raw RPC methods.
- Wired validation before raw RPC submission so malformed params fail locally.
- Added unit tests for required fields, route arrays, and read-method pass-through.

## Verification

- Frontend typecheck validates raw console validation wiring.
- Unit tests cover the new validation paths.

## Remaining Gaps

- Validation is hand-authored from the current method map, not generated from a formal schema.
- Numeric/hash/script fields are checked for presence and broad JSON shape, not full Fiber type semantics.
- No live raw-console RPC smoke test was executed.
