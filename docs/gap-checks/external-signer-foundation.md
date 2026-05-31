# External Signer Foundation Gap Check

Date: 2026-06-01

## Knowledge Graph Check

No MCP knowledge graph resources were exposed in this session. Gap checking used local source references:

- `docs/rpc-method-map.md`
- `references/fiber/docs/external-funding.md`
- `references/fiber/crates/fiber-lib/src/rpc/README.md`
- `references/fiber/crates/fiber-json-types/src/channel.rs`
- `references/ccc/README.md`
- `references/ccc/packages/core/src/signer`

## Implemented

- Added guarded RPC allowlist entries for `open_channel_with_external_funding`, `submit_signed_funding_tx`, and `sign_external_funding_tx`.
- Added an External Signer view with explicit FNN internal wallet versus external signer fund ownership separation.
- Added external funding channel open workflow requiring funding lock script and shutdown script JSON.
- Added unsigned funding transaction display and signed transaction paste/submit flow.
- Added witness-only structure checks for externally signed funding transactions.
- Added CCC/JoyID/manual signer path selection and a dev-RPC signing path for debug FNN builds.
- Extended mock RPC for external funding open, dev signing, and signed funding submission.
- Added tests for mock external funding and witness-only transaction structure validation.

## Verification

- Frontend typecheck validates the External Signer view and RPC parameter shapes.
- Unit tests cover witness-only structure checks and mock external funding open/sign/submit flow.
- Backend Rust tests confirm the expanded command allowlist still compiles and existing guards remain active.

## Remaining Gaps

- CCC/JoyID signing is prepared as a payload/workbench but does not yet invoke a live CCC connector.
- No live testnet external funding flow was executed.
- Funding lock script and shutdown script are manual JSON fields; CCC address-to-script helpers are not wired yet.
- `sign_external_funding_tx` is debug/dev only in Fiber and should not be offered as a release signing path once real CCC/JoyID signing is active.
- The UI does not yet validate CKB script schemas beyond JSON object parsing.
